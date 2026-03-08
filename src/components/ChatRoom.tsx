import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, X, RotateCcw, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase, getSessionId } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface ChatRoomProps {
  category: string;
  tags: string[];
  onDisconnect: () => void;
}

interface Message {
  id: string;
  text: string;
  sender: "you" | "stranger" | "system";
  timestamp: Date;
}

const ChatRoom = ({ category, tags, onDisconnect }: ChatRoomProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isConnecting, setIsConnecting] = useState(true);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [strangerDisconnected, setStrangerDisconnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionId = useRef(getSessionId()).current;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Cleanup function
  const cleanup = useCallback(async () => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    // Remove from queue
    await supabase.from("chat_queue").delete().eq("session_id", sessionId);
    // Mark room as inactive
    if (roomId) {
      await supabase.from("chat_rooms").update({ is_active: false }).eq("id", roomId);
    }
  }, [sessionId, roomId]);

  // Subscribe to a chat room
  const subscribeToRoom = useCallback(
    (rid: string) => {
      setRoomId(rid);
      setIsConnecting(false);
      setStrangerDisconnected(false);
      setMessages([
        {
          id: "system-connected",
          text: "You're now chatting with a real stranger. Say hi! 🎉",
          sender: "system",
          timestamp: new Date(),
        },
      ]);

      // Load existing messages
      supabase
        .from("chat_messages")
        .select("*")
        .eq("room_id", rid)
        .order("created_at", { ascending: true })
        .then(({ data }) => {
          if (data && data.length > 0) {
            const msgs: Message[] = data.map((m) => ({
              id: m.id,
              text: m.message,
              sender: m.sender_session === sessionId ? "you" : "stranger",
              timestamp: new Date(m.created_at),
            }));
            setMessages((prev) => [...prev, ...msgs]);
          }
        });

      // Subscribe to new messages in real-time
      const channel = supabase
        .channel(`room-${rid}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "chat_messages",
            filter: `room_id=eq.${rid}`,
          },
          (payload) => {
            const msg = payload.new as any;
            if (msg.sender_session !== sessionId) {
              setMessages((prev) => [
                ...prev,
                {
                  id: msg.id,
                  text: msg.message,
                  sender: "stranger",
                  timestamp: new Date(msg.created_at),
                },
              ]);
            }
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "chat_rooms",
            filter: `id=eq.${rid}`,
          },
          (payload) => {
            const room = payload.new as any;
            if (!room.is_active) {
              setStrangerDisconnected(true);
              setMessages((prev) => [
                ...prev,
                {
                  id: `system-disc-${Date.now()}`,
                  text: "Stranger has disconnected.",
                  sender: "system",
                  timestamp: new Date(),
                },
              ]);
            }
          }
        )
        .subscribe();

      channelRef.current = channel;
    },
    [sessionId]
  );

  // Find a match
  const findMatch = useCallback(async () => {
    setIsConnecting(true);
    setMessages([]);
    setRoomId(null);
    setStrangerDisconnected(false);

    // Clean up previous
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    // Remove old queue entries
    await supabase.from("chat_queue").delete().eq("session_id", sessionId);

    // Check if someone is already waiting in this category
    const { data: waiting } = await supabase
      .from("chat_queue")
      .select("*")
      .eq("category", category)
      .neq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .limit(1);

    if (waiting && waiting.length > 0) {
      const partner = waiting[0];
      // Remove partner from queue
      await supabase.from("chat_queue").delete().eq("id", partner.id);

      // Create a room
      const { data: room } = await supabase
        .from("chat_rooms")
        .insert({
          user1_session: partner.session_id,
          user2_session: sessionId,
          category,
          is_active: true,
        })
        .select()
        .single();

      if (room) {
        subscribeToRoom(room.id);
      }
    } else {
      // Join the queue
      await supabase.from("chat_queue").upsert(
        { session_id: sessionId, category, tags },
        { onConflict: "session_id" }
      );

      // Poll for a room where we got matched
      pollingRef.current = setInterval(async () => {
        const { data: rooms } = await supabase
          .from("chat_rooms")
          .select("*")
          .eq("is_active", true)
          .or(`user1_session.eq.${sessionId},user2_session.eq.${sessionId}`)
          .order("created_at", { ascending: false })
          .limit(1);

        if (rooms && rooms.length > 0) {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          // Remove from queue
          await supabase.from("chat_queue").delete().eq("session_id", sessionId);
          subscribeToRoom(rooms[0].id);
        }
      }, 2000);
    }
  }, [category, tags, sessionId, subscribeToRoom]);

  // Start matching on mount
  useEffect(() => {
    findMatch();
    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || !roomId || strangerDisconnected) return;

    // Optimistic update
    const tempId = `you-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: tempId, text: trimmed, sender: "you", timestamp: new Date() },
    ]);
    setInput("");
    inputRef.current?.focus();

    await supabase.from("chat_messages").insert({
      room_id: roomId,
      sender_session: sessionId,
      message: trimmed,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const reconnect = async () => {
    await cleanup();
    findMatch();
  };

  const handleLeave = async () => {
    await cleanup();
    onDisconnect();
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="glass border-b border-border/50 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-gradient">whispr</h1>
          <Badge variant="outline" className="text-xs text-muted-foreground">
            {category}
          </Badge>
          {tags.slice(0, 3).map((t) => (
            <Badge key={t} variant="outline" className="text-xs text-muted-foreground hidden md:inline-flex">
              {t}
            </Badge>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={reconnect}
            className="text-muted-foreground hover:text-primary"
          >
            <RotateCcw className="w-4 h-4 mr-1" /> New
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLeave}
            className="text-muted-foreground hover:text-destructive"
          >
            <X className="w-4 h-4 mr-1" /> Leave
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-3">
        {isConnecting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center h-full gap-4"
          >
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-3 h-3 rounded-full bg-primary"
                  animate={{ y: [0, -12, 0] }}
                  transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }}
                />
              ))}
            </div>
            <p className="text-muted-foreground font-mono text-sm">
              Looking for a stranger...
            </p>
          </motion.div>
        )}

        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${
                msg.sender === "you" ? "justify-end" : msg.sender === "system" ? "justify-center" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                  msg.sender === "you"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : msg.sender === "system"
                    ? "bg-secondary/50 text-muted-foreground text-center text-xs italic max-w-full"
                    : "bg-secondary text-secondary-foreground rounded-bl-md"
                }`}
              >
                {msg.text}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="glass border-t border-border/50 px-4 py-3">
        <div className="flex items-center gap-2 max-w-3xl mx-auto">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-2">
            <Shield className="w-3.5 h-3.5 text-primary" />
            <span className="hidden sm:inline font-mono">Anonymous</span>
          </div>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isConnecting
                ? "Connecting..."
                : strangerDisconnected
                ? "Stranger left. Click 'New' to find another."
                : "Type a message..."
            }
            disabled={isConnecting || strangerDisconnected}
            className="flex-1 bg-secondary/50 border border-border/50 rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors disabled:opacity-50"
          />
          <Button
            size="sm"
            disabled={!input.trim() || isConnecting || strangerDisconnected}
            onClick={sendMessage}
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl px-4"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatRoom;
