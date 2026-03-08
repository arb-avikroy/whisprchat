import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, X, RotateCcw, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

const getSessionId = (): string => {
  let sessionId = sessionStorage.getItem("whispr_session_id");
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem("whispr_session_id", sessionId);
  }
  return sessionId;
};

interface ChatRoomProps {
  category: string;
  tags: string[];
  onDisconnect: () => void;
}

interface Message {
  id: string;
  text: string;
  sender: "you" | "stranger";
  timestamp: Date;
}

const STRANGER_RESPONSES = [
  "Hey! How's it going?",
  "Nice to meet you, stranger 😄",
  "What brings you here today?",
  "That's interesting, tell me more!",
  "Haha, I totally agree with that",
  "I've been thinking about the same thing lately",
  "Cool! Where are you from?",
  "That's a great point actually",
  "I love that perspective",
  "So what do you do for fun?",
  "That reminds me of something...",
  "Wow, I never thought of it that way",
];

const ChatRoom = ({ category, tags, onDisconnect }: ChatRoomProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isConnecting, setIsConnecting] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Simulate finding a stranger
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsConnecting(false);
      setMessages([
        {
          id: "system-1",
          text: "You're now chatting with a random stranger. Say hi!",
          sender: "stranger",
          timestamp: new Date(),
        },
      ]);
    }, 2000 + Math.random() * 2000);
    return () => clearTimeout(timer);
  }, []);

  const simulateReply = useCallback(() => {
    setIsTyping(true);
    const delay = 1500 + Math.random() * 3000;
    setTimeout(() => {
      setIsTyping(false);
      const response = STRANGER_RESPONSES[Math.floor(Math.random() * STRANGER_RESPONSES.length)];
      setMessages((prev) => [
        ...prev,
        {
          id: `stranger-${Date.now()}`,
          text: response,
          sender: "stranger",
          timestamp: new Date(),
        },
      ]);
    }, delay);
  }, []);

  const sendMessage = () => {
    const trimmed = input.trim();
    if (!trimmed || isConnecting) return;
    setMessages((prev) => [
      ...prev,
      { id: `you-${Date.now()}`, text: trimmed, sender: "you", timestamp: new Date() },
    ]);
    setInput("");
    inputRef.current?.focus();
    // Simulate stranger response
    if (Math.random() > 0.2) simulateReply();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const reconnect = () => {
    setMessages([]);
    setIsConnecting(true);
    setIsTyping(false);
    setTimeout(() => {
      setIsConnecting(false);
      setMessages([
        {
          id: "system-new",
          text: "You're now chatting with a new stranger. Say hi!",
          sender: "stranger",
          timestamp: new Date(),
        },
      ]);
    }, 2000 + Math.random() * 2000);
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
            onClick={onDisconnect}
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
              Finding a stranger...
            </p>
          </motion.div>
        )}

        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.sender === "you" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                  msg.sender === "you"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : msg.id.startsWith("system")
                    ? "bg-secondary/50 text-muted-foreground text-center text-xs italic max-w-full w-full"
                    : "bg-secondary text-secondary-foreground rounded-bl-md"
                }`}
              >
                {msg.text}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isTyping && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="bg-secondary rounded-2xl rounded-bl-md px-4 py-3 flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 rounded-full bg-muted-foreground"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                />
              ))}
            </div>
          </motion.div>
        )}

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
            placeholder={isConnecting ? "Connecting..." : "Type a message..."}
            disabled={isConnecting}
            className="flex-1 bg-secondary/50 border border-border/50 rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors disabled:opacity-50"
          />
          <Button
            size="sm"
            disabled={!input.trim() || isConnecting}
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
