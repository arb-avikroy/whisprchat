import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, Users, Globe, Shield, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ChatRoom from "@/components/ChatRoom";

const CATEGORIES = [
  { id: "casual", label: "Casual Chat", icon: MessageCircle, desc: "Everyday conversations" },
  { id: "gaming", label: "Gaming", icon: Users, desc: "Find gaming buddies" },
  { id: "tech", label: "Tech Talk", icon: Globe, desc: "Discuss technology" },
  { id: "music", label: "Music", icon: MessageCircle, desc: "Share your taste" },
  { id: "movies", label: "Movies & TV", icon: MessageCircle, desc: "Entertainment talk" },
  { id: "random", label: "Random", icon: Globe, desc: "Surprise connections" },
];

const ALL_TAGS = [
  "Friendly", "Deep Talks", "Humor", "Advice", "Venting",
  "Language Exchange", "Debate", "Study Buddy", "Night Owl", "Introvert",
  "Travel", "Food", "Sports", "Art", "Science",
];

const Index = () => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isChatting, setIsChatting] = useState(false);
  const [queueCounts, setQueueCounts] = useState<Record<string, number>>({});

  // Fetch queue counts and subscribe to real-time changes
  useEffect(() => {
    const fetchCounts = async () => {
      const { data } = await supabase.from("chat_queue").select("category");
      if (data) {
        const counts: Record<string, number> = {};
        data.forEach((row) => {
          counts[row.category] = (counts[row.category] || 0) + 1;
        });
        setQueueCounts(counts);
      }
    };

    fetchCounts();

    const channel = supabase
      .channel("queue-counts")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_queue" },
        () => fetchCounts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag].slice(0, 5)
    );
  };

  const startChat = () => {
    if (selectedCategory) setIsChatting(true);
  };

  if (isChatting) {
    return (
      <ChatRoom
        category={selectedCategory!}
        tags={selectedTags}
        onDisconnect={() => setIsChatting(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-accent/5 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-online pulse-online" />
            <span className="text-sm text-muted-foreground font-mono">
              12,847 strangers online
            </span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold mb-4 tracking-tight">
            <span className="text-gradient">whispr</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-md mx-auto">
            Talk to strangers anonymously. No accounts. No history. Just raw conversations.
          </p>
          <div className="flex items-center justify-center gap-4 mt-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-primary" /> Anonymous
            </span>
            <span className="flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-primary" /> Worldwide
            </span>
          </div>
        </motion.div>

        {/* Categories */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-10"
        >
          <h2 className="text-sm font-mono text-muted-foreground uppercase tracking-widest mb-4">
            Choose a category
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`glass rounded-lg p-4 text-left transition-all duration-200 hover:border-primary/40 ${
                    isSelected ? "border-primary glow-primary" : ""
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Icon className={`w-5 h-5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                    {(queueCounts[cat.id] || 0) > 0 && (
                      <span className="flex items-center gap-1 text-xs text-online font-mono">
                        <span className="w-1.5 h-1.5 rounded-full bg-online pulse-online" />
                        {queueCounts[cat.id]}
                      </span>
                    )}
                  </div>
                  <div className="font-medium text-sm">{cat.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{cat.desc}</div>
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Tags */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-12"
        >
          <h2 className="text-sm font-mono text-muted-foreground uppercase tracking-widest mb-4">
            Add interests <span className="text-primary">(max 5)</span>
          </h2>
          <div className="flex flex-wrap gap-2">
            {ALL_TAGS.map((tag) => {
              const isSelected = selectedTags.includes(tag);
              return (
                <Badge
                  key={tag}
                  variant={isSelected ? "default" : "outline"}
                  className={`cursor-pointer transition-all text-xs py-1.5 px-3 ${
                    isSelected
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "hover:border-primary/50 text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </Badge>
              );
            })}
          </div>
        </motion.div>

        {/* Start Button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45 }}
          className="text-center"
        >
          <Button
            size="lg"
            disabled={!selectedCategory}
            onClick={startChat}
            className="bg-primary text-primary-foreground hover:bg-primary/90 glow-primary px-8 py-6 text-lg font-semibold rounded-xl transition-all disabled:opacity-30 disabled:shadow-none"
          >
            Start Chatting <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
          {!selectedCategory && (
            <p className="text-xs text-muted-foreground mt-3">Select a category to begin</p>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default Index;
