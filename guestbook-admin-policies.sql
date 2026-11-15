-- Run this once in Supabase SQL Editor after confirming your user ID is in public.guestbook_admins.
-- The admin table should contain a row whose user_id equals auth.users.id for your admin login.

ALTER TABLE public.guestbook_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read their own admin record" ON public.guestbook_admins;
CREATE POLICY "Admins can read their own admin record"
ON public.guestbook_admins FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Admins can read all guestbook wishes" ON public.guestbook_wishes;
CREATE POLICY "Admins can read all guestbook wishes"
ON public.guestbook_wishes FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.guestbook_admins a WHERE a.user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Admins can update guestbook wishes" ON public.guestbook_wishes;
CREATE POLICY "Admins can update guestbook wishes"
ON public.guestbook_wishes FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.guestbook_admins a WHERE a.user_id = (SELECT auth.uid())))
WITH CHECK (EXISTS (SELECT 1 FROM public.guestbook_admins a WHERE a.user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Admins can delete guestbook wishes" ON public.guestbook_wishes;
CREATE POLICY "Admins can delete guestbook wishes"
ON public.guestbook_wishes FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.guestbook_admins a WHERE a.user_id = (SELECT auth.uid())));

GRANT SELECT ON public.guestbook_admins TO authenticated;
GRANT SELECT, UPDATE, DELETE ON public.guestbook_wishes TO authenticated;
