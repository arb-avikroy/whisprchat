
-- Table for users waiting to be matched
CREATE TABLE public.chat_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table for active chat rooms
CREATE TABLE public.chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_session TEXT NOT NULL,
  user2_session TEXT NOT NULL,
  category TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table for messages
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  sender_session TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chat_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Since this is anonymous (no auth), we use permissive policies
CREATE POLICY "Anyone can join queue" ON public.chat_queue FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can access rooms" ON public.chat_rooms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can access messages" ON public.chat_messages FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime on messages and rooms
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_rooms;

-- Index for faster queue matching
CREATE INDEX idx_chat_queue_category ON public.chat_queue(category);
CREATE INDEX idx_chat_messages_room ON public.chat_messages(room_id);
CREATE INDEX idx_chat_rooms_active ON public.chat_rooms(is_active);
