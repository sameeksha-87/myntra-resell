-- 20260716190000_production_schema.sql
-- Evolve ReSell by Myntra prototype database schema to production-ready normalized design.

-- Drop old tables/triggers if they exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP TABLE IF EXISTS public.bag_items;
DROP TABLE IF EXISTS public.wishlist_items;
DROP TABLE IF EXISTS public.listings;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Re-create profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone_e164 TEXT,
  avatar_url TEXT,
  seller_score NUMERIC DEFAULT 5.0,
  preferences JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Roles table
CREATE TABLE public.user_roles (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('buyer', 'seller', 'inspector', 'admin')),
  PRIMARY KEY (user_id, role)
);

-- Addresses
CREATE TABLE public.addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient TEXT NOT NULL,
  phone TEXT NOT NULL,
  line1 TEXT NOT NULL,
  line2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  pincode TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  serviceable BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Brands
CREATE TABLE public.brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  tier TEXT NOT NULL, -- 'Premium', 'Standard', 'Budget'
  active BOOLEAN DEFAULT true
);

-- Categories
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  name TEXT UNIQUE NOT NULL,
  active BOOLEAN DEFAULT true
);

-- Myntra Orders
CREATE TABLE public.myntra_orders (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Myntra Order Items
CREATE TABLE public.myntra_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL REFERENCES public.myntra_orders(id) ON DELETE CASCADE,
  product_reference TEXT NOT NULL,
  brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  size TEXT NOT NULL,
  original_price_paise BIGINT NOT NULL,
  image TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'delivered'
);

-- Eligibility Decisions
CREATE TABLE public.eligibility_decisions (
  order_item_id UUID PRIMARY KEY REFERENCES public.myntra_order_items(id) ON DELETE CASCADE,
  eligible BOOLEAN NOT NULL,
  rule_version TEXT NOT NULL,
  reason_code TEXT,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_data_hash TEXT,
  reviewer_details JSONB
);

-- Listings
CREATE TABLE public.listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_order_item_id UUID REFERENCES public.myntra_order_items(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  brand TEXT NOT NULL,
  category TEXT NOT NULL,
  size TEXT NOT NULL,
  declared_grade TEXT NOT NULL,
  confirmed_grade TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  current_price_paise BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  verification_disposition TEXT,
  publish_timestamp TIMESTAMPTZ,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_order_item_listing UNIQUE (source_order_item_id)
);

-- Listing Media
CREATE TABLE public.listing_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'image',
  angle TEXT NOT NULL,
  sha256 TEXT,
  content_metadata JSONB DEFAULT '{}'::jsonb,
  capture_metadata JSONB DEFAULT '{}'::jsonb,
  sort_order INT NOT NULL DEFAULT 0,
  moderation_status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Verification Runs
CREATE TABLE public.verification_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'builtin',
  status TEXT NOT NULL DEFAULT 'pending',
  confidence REAL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  raw_result_pointer TEXT,
  error_reason TEXT
);

-- Verification Checks
CREATE TABLE public.verification_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_run_id UUID NOT NULL REFERENCES public.verification_runs(id) ON DELETE CASCADE,
  check_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  score REAL,
  threshold REAL,
  reason_code TEXT,
  evidence JSONB DEFAULT '{}'::jsonb
);

-- Inspection Reports
CREATE TABLE public.inspection_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  inspector_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  confirmed_grade TEXT NOT NULL,
  passed BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  evidence JSONB DEFAULT '{}'::jsonb,
  location TEXT,
  inspected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  price_revision_data JSONB
);

-- Pricing Rule Versions
CREATE TABLE public.pricing_rule_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_to TIMESTAMPTZ,
  factors JSONB NOT NULL,
  commission_rate REAL NOT NULL DEFAULT 0.40,
  buyer_protection_fee_paise BIGINT NOT NULL DEFAULT 0,
  delivery_fee_paise BIGINT NOT NULL DEFAULT 0,
  seller_deposit_paise BIGINT NOT NULL DEFAULT 0,
  tax_settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Price Quotes
CREATE TABLE public.price_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  rule_version_id UUID NOT NULL REFERENCES public.pricing_rule_versions(id),
  source_event TEXT NOT NULL,
  original_price_paise BIGINT NOT NULL,
  age_years REAL NOT NULL,
  grade TEXT NOT NULL,
  factors JSONB NOT NULL,
  listing_price_paise BIGINT NOT NULL,
  seller_payout_paise BIGINT NOT NULL,
  commission_paise BIGINT NOT NULL,
  fees_paise JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Listing Events (State Transitions)
CREATE TABLE public.listing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  sequence INT NOT NULL,
  event_type TEXT NOT NULL,
  from_state TEXT,
  to_state TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id UUID,
  payload JSONB DEFAULT '{}'::jsonb,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Wishlist
CREATE TABLE public.wishlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_wishlist UNIQUE (user_id, listing_id)
);

-- Bag
CREATE TABLE public.bag_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  size TEXT,
  quantity INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_bag UNIQUE (user_id, listing_id)
);

-- Resale Orders
CREATE TABLE public.resale_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  final_price_paise BIGINT NOT NULL,
  payout_paise BIGINT NOT NULL,
  commission_paise BIGINT NOT NULL,
  buyer_fees_paise BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'created',
  shipping_address_id UUID REFERENCES public.addresses(id) ON DELETE SET NULL,
  buyer_protection_expiry TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_order_listing UNIQUE (listing_id)
);

-- Payment Transactions
CREATE TABLE public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.resale_orders(id) ON DELETE CASCADE,
  provider_payment_intent_id TEXT,
  type TEXT NOT NULL, -- 'authorize', 'capture', 'refund'
  amount_paise BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'pending',
  payload JSONB DEFAULT '{}'::jsonb,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ledger Entries (Double-Entry Balance)
CREATE TABLE public.ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_type TEXT NOT NULL,
  reference_id UUID NOT NULL,
  account_from TEXT NOT NULL, -- e.g. 'escrow', 'buyer', 'myntra_commission', 'seller_payable'
  account_to TEXT NOT NULL,
  amount_paise BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seller Payouts
CREATE TABLE public.seller_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.resale_orders(id) ON DELETE CASCADE,
  amount_paise BIGINT NOT NULL,
  method TEXT NOT NULL DEFAULT 'credits', -- 'credits', 'bank', 'upi'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'paid', 'failed'
  provider_reference TEXT,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pickup Jobs
CREATE TABLE public.pickup_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  address_id UUID REFERENCES public.addresses(id) ON DELETE SET NULL,
  scheduled_slot TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled', -- 'scheduled', 'picked_up', 'failed'
  tracking_number TEXT,
  evidence JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Shipments
CREATE TABLE public.shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.resale_orders(id) ON DELETE CASCADE,
  carrier TEXT,
  tracking_number TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'in_transit', 'delivered', 'returned'
  delivery_proof JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tracking Events
CREATE TABLE public.tracking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  location TEXT,
  description TEXT,
  event_payload JSONB DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Buyer Approvals
CREATE TABLE public.buyer_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.resale_orders(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'price_revision'
  old_terms JSONB NOT NULL,
  new_terms JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'expired'
  decided_at TIMESTAMPTZ,
  expiry TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Disputes
CREATE TABLE public.disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.resale_orders(id) ON DELETE CASCADE,
  complainant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  evidence_urls TEXT[],
  status TEXT NOT NULL DEFAULT 'open', -- 'open', 'resolved_refunded', 'resolved_released', 'dismissed'
  resolution TEXT,
  deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'in_app',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  delivery_status TEXT NOT NULL DEFAULT 'sent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit Logs
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  payload_before JSONB,
  payload_after JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

----------------------------------------------------
-- ROLES & RLS SETUP
----------------------------------------------------

CREATE OR REPLACE FUNCTION public.has_role(user_id UUID, check_role TEXT)
RETURNS BOOLEAN SECURITY DEFINER AS $$
BEGIN
  -- Buyers and sellers are implicit roles for all authenticated users
  IF check_role IN ('buyer', 'seller') THEN
    RETURN TRUE;
  END IF;
  
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = has_role.user_id AND user_roles.role = check_role
  );
END;
$$ LANGUAGE plpgsql;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.myntra_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.myntra_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eligibility_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_rule_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bag_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resale_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickup_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyer_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- Policies for public data (anyone can read, admins write)
CREATE POLICY "Public read brands" ON public.brands FOR SELECT USING (active = true);
CREATE POLICY "Admin manage brands" ON public.brands FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Public read categories" ON public.categories FOR SELECT USING (active = true);
CREATE POLICY "Admin manage categories" ON public.categories FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Public read pricing rules" ON public.pricing_rule_versions FOR SELECT USING (true);
CREATE POLICY "Admin manage pricing rules" ON public.pricing_rule_versions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Policies for Profiles
CREATE POLICY "Profiles are readable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Policies for User Roles
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admin manage user roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Policies for Addresses
CREATE POLICY "Users manage own addresses" ON public.addresses FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Staff read all addresses" ON public.addresses FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inspector'));

-- Policies for Orders & Items (Myntra order sync)
CREATE POLICY "Users view own Myntra orders" ON public.myntra_orders FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users view own Myntra order items" ON public.myntra_order_items FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.myntra_orders WHERE id = order_id AND user_id = auth.uid())
);
CREATE POLICY "Users view own eligibility decisions" ON public.eligibility_decisions FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.myntra_order_items oi
    JOIN public.myntra_orders o ON o.id = oi.order_id
    WHERE oi.id = order_item_id AND o.user_id = auth.uid()
  )
);

-- Policies for Listings
CREATE POLICY "Anyone view live and sold listings" ON public.listings FOR SELECT USING (status IN ('live', 'reserved', 'sold', 'pickup_scheduled', 'picked_up', 'inspection_pending', 'inspection_passed', 'inspection_revised', 'buyer_approval_pending', 'payout_pending', 'paid'));
CREATE POLICY "Sellers manage own listings" ON public.listings FOR ALL TO authenticated USING (auth.uid() = seller_id) WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "Staff manage all listings" ON public.listings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inspector'));

CREATE POLICY "Anyone view live media" ON public.listing_media FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.listings WHERE id = listing_id AND status IN ('live', 'reserved', 'sold', 'pickup_scheduled', 'picked_up', 'inspection_pending', 'inspection_passed', 'inspection_revised', 'buyer_approval_pending', 'payout_pending', 'paid'))
);
CREATE POLICY "Sellers manage own media" ON public.listing_media FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.listings WHERE id = listing_id AND seller_id = auth.uid())
);

-- Policies for Wishlist & Bag
CREATE POLICY "Users manage own wishlist" ON public.wishlist_items FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own bag" ON public.bag_items FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Policies for Verification, Inspections, Audits, Quotes
CREATE POLICY "Sellers view own quotes" ON public.price_quotes FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.listings WHERE id = listing_id AND seller_id = auth.uid())
);
CREATE POLICY "Sellers view own runs" ON public.verification_runs FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.listings WHERE id = listing_id AND seller_id = auth.uid())
);
CREATE POLICY "Sellers view own checks" ON public.verification_checks FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.verification_runs r
    JOIN public.listings l ON l.id = r.listing_id
    WHERE r.id = verification_run_id AND l.seller_id = auth.uid()
  )
);
CREATE POLICY "Staff manage verification and quotes" ON public.price_quotes FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inspector'));
CREATE POLICY "Staff manage verification runs" ON public.verification_runs FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inspector'));
CREATE POLICY "Staff manage verification checks" ON public.verification_checks FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inspector'));

CREATE POLICY "Sellers view own reports" ON public.inspection_reports FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.listings WHERE id = listing_id AND seller_id = auth.uid())
);
CREATE POLICY "Buyers view own reports" ON public.inspection_reports FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.resale_orders o
    WHERE o.listing_id = listing_id AND o.buyer_id = auth.uid()
  )
);
CREATE POLICY "Staff manage reports" ON public.inspection_reports FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inspector'));

-- Policies for Commerce (Orders, ledger, payouts, logistics)
CREATE POLICY "Users view own resale orders" ON public.resale_orders FOR SELECT TO authenticated USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
CREATE POLICY "Staff manage resale orders" ON public.resale_orders FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inspector'));

CREATE POLICY "Users view own payments" ON public.payment_transactions FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.resale_orders o WHERE o.id = order_id AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid()))
);
CREATE POLICY "Staff manage payments" ON public.payment_transactions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users view own payouts" ON public.seller_payouts FOR SELECT TO authenticated USING (auth.uid() = seller_id);
CREATE POLICY "Staff manage payouts" ON public.seller_payouts FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users view own pickup jobs" ON public.pickup_jobs FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.seller_id = auth.uid())
);
CREATE POLICY "Staff manage pickup jobs" ON public.pickup_jobs FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inspector'));

CREATE POLICY "Users view own shipments" ON public.shipments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.resale_orders o WHERE o.id = order_id AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid()))
);
CREATE POLICY "Staff manage shipments" ON public.shipments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inspector'));

CREATE POLICY "Users view own approvals" ON public.buyer_approvals FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.resale_orders o WHERE o.id = order_id AND o.buyer_id = auth.uid())
);
CREATE POLICY "Sellers view own approvals" ON public.buyer_approvals FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.resale_orders o WHERE o.id = order_id AND o.seller_id = auth.uid())
);
CREATE POLICY "Staff manage approvals" ON public.buyer_approvals FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inspector'));

CREATE POLICY "Users view own disputes" ON public.disputes FOR SELECT TO authenticated USING (auth.uid() = complainant_id OR EXISTS (SELECT 1 FROM public.resale_orders o WHERE o.id = order_id AND o.seller_id = auth.uid()));
CREATE POLICY "Staff manage disputes" ON public.disputes FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users view own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);

----------------------------------------------------
-- DATABASE FUNCTIONS & TRIGGERS
----------------------------------------------------

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Insert into profiles
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', 'https://api.dicebear.com/7.x/adventurer/svg?seed=' || NEW.id)
  )
  ON CONFLICT (id) DO NOTHING;

  -- Default user roles (buyer, seller implicitly; assign admin role if email is samee@myntra.com or similar for test ease)
  IF NEW.email IN ('samee@myntra.com', 'admin@resell.com', 'inspector@resell.com') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'), (NEW.id, 'inspector')
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Revoke function execute privileges on handle_new_user
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Function to seed brands & categories
CREATE OR REPLACE FUNCTION public.seed_catalog_metadata()
RETURNS VOID SECURITY DEFINER AS $$
DECLARE
  apparel_cat_id UUID;
  shoes_cat_id UUID;
  outer_cat_id UUID;
  jeans_cat_id UUID;
  blazer_cat_id UUID;
  bag_cat_id UUID;
BEGIN
  -- Seed Brands
  INSERT INTO public.brands (name, tier) VALUES
    ('Tommy Hilfiger', 'Premium'),
    ('Nike', 'Premium'),
    ('Zara', 'Premium'),
    ('Levi''s', 'Premium'),
    ('Mango', 'Premium'),
    ('H&M', 'Standard'),
    ('Vero Moda', 'Standard'),
    ('Roadster', 'Standard')
  ON CONFLICT (name) DO NOTHING;

  -- Seed Categories
  INSERT INTO public.categories (name) VALUES ('Dresses') ON CONFLICT (name) DO NOTHING;
  
  INSERT INTO public.categories (name) VALUES ('Sneakers') ON CONFLICT (name) DO NOTHING;
  
  INSERT INTO public.categories (name) VALUES ('Outerwear') ON CONFLICT (name) DO NOTHING;
  
  INSERT INTO public.categories (name) VALUES ('Denim') ON CONFLICT (name) DO NOTHING;
  
  INSERT INTO public.categories (name) VALUES ('Blazers') ON CONFLICT (name) DO NOTHING;
  
  INSERT INTO public.categories (name) VALUES ('Bags') ON CONFLICT (name) DO NOTHING;
  
  INSERT INTO public.categories (name) VALUES ('Luxury') ON CONFLICT (name) DO NOTHING;
  
  INSERT INTO public.categories (name) VALUES ('Kids') ON CONFLICT (name) DO NOTHING;

  -- Seed Pricing Rules (if none exists)
  IF NOT EXISTS (SELECT 1 FROM public.pricing_rule_versions) THEN
    INSERT INTO public.pricing_rule_versions (factors, commission_rate, buyer_protection_fee_paise, delivery_fee_paise, seller_deposit_paise)
    VALUES (
      '{
        "Pristine": 1.00,
        "Excellent": 0.85,
        "Good": 0.70,
        "depreciation_per_year": 0.20
      }'::jsonb,
      0.40,
      0, -- free delivery/buyer protection as in prototype
      0,
      7900 -- ₹79 in paise
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to seed mock orders for a user
CREATE OR REPLACE FUNCTION public.seed_user_mock_orders(target_user_id UUID)
RETURNS VOID SECURITY DEFINER AS $$
DECLARE
  brand_tommy UUID;
  brand_nike UUID;
  brand_zara UUID;
  brand_levis UUID;
  brand_roadster UUID;
  
  cat_outer UUID;
  cat_shoes UUID;
  cat_skirts UUID;
  cat_shirts UUID;
BEGIN
  -- First seed standard catalog metadata
  PERFORM public.seed_catalog_metadata();

  -- Get brand and category UUIDs
  SELECT id INTO brand_tommy FROM public.brands WHERE name = 'Tommy Hilfiger';
  SELECT id INTO brand_nike FROM public.brands WHERE name = 'Nike';
  SELECT id INTO brand_zara FROM public.brands WHERE name = 'Zara';
  SELECT id INTO brand_levis FROM public.brands WHERE name = 'Levi''s';
  SELECT id INTO brand_roadster FROM public.brands WHERE name = 'Roadster';
  
  SELECT id INTO cat_outer FROM public.categories WHERE name = 'Outerwear';
  SELECT id INTO cat_shoes FROM public.categories WHERE name = 'Sneakers';
  SELECT id INTO cat_skirts FROM public.categories WHERE name = 'Dresses'; -- maps to Dresses in UI
  SELECT id INTO cat_shirts FROM public.categories WHERE name = 'Kids'; -- or shirts if added, mapping to Kids for categorization demo

  -- If user doesn't have orders, create them
  IF NOT EXISTS (SELECT 1 FROM public.myntra_orders WHERE user_id = target_user_id) THEN
    -- Order 1
    INSERT INTO public.myntra_orders (id, user_id, delivered_at)
    VALUES ('o-101', target_user_id, now() - INTERVAL '1 year');
    
    INSERT INTO public.myntra_order_items (id, order_id, product_reference, brand_id, category_id, title, size, original_price_paise, image, quantity, status)
    VALUES (
      '11111111-1111-1111-1111-111111111111',
      'o-101',
      'TH-JACKET-001',
      brand_tommy,
      cat_outer,
      'Colour-Block Puffer Jacket',
      'M',
      1499900, -- ₹14,999 in paise
      'https://images.unsplash.com/photo-1548883354-7622d03aca27?auto=format&fit=crop&q=80&w=400',
      1,
      'delivered'
    );
    
    -- Order 2
    INSERT INTO public.myntra_orders (id, user_id, delivered_at)
    VALUES ('o-102', target_user_id, now() - INTERVAL '2 years');
    
    INSERT INTO public.myntra_order_items (id, order_id, product_reference, brand_id, category_id, title, size, original_price_paise, image, quantity, status)
    VALUES (
      '22222222-2222-2222-2222-222222222222',
      'o-102',
      'NIKE-COURT-002',
      brand_nike,
      cat_shoes,
      'Court Vision Low Sneakers',
      'UK 8',
      649500, -- ₹6,495 in paise
      'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&q=80&w=400',
      1,
      'delivered'
    );
    
    -- Order 3
    INSERT INTO public.myntra_orders (id, user_id, delivered_at)
    VALUES ('o-103', target_user_id, now() - INTERVAL '6 months');
    
    INSERT INTO public.myntra_order_items (id, order_id, product_reference, brand_id, category_id, title, size, original_price_paise, image, quantity, status)
    VALUES (
      '33333333-3333-3333-3333-333333333333',
      'o-103',
      'ZARA-SKIRT-003',
      brand_zara,
      cat_skirts,
      'Pleated Satin Midi Skirt',
      'S',
      399000, -- ₹3,990 in paise
      'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&q=80&w=400',
      1,
      'delivered'
    );

    -- Order 4
    INSERT INTO public.myntra_orders (id, user_id, delivered_at)
    VALUES ('o-104', target_user_id, now() - INTERVAL '1 year');
    
    INSERT INTO public.myntra_order_items (id, order_id, product_reference, brand_id, category_id, title, size, original_price_paise, image, quantity, status)
    VALUES (
      '44444444-4444-4444-4444-444444444444',
      'o-104',
      'LEVIS-TRUCKER-004',
      brand_levis,
      cat_outer,
      'Trucker Denim Jacket',
      'L',
      549900, -- ₹5,499 in paise
      'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?auto=format&fit=crop&q=80&w=400',
      1,
      'delivered'
    );

    -- Order 5
    INSERT INTO public.myntra_orders (id, user_id, delivered_at)
    VALUES ('o-105', target_user_id, now() - INTERVAL '1 year');
    
    INSERT INTO public.myntra_order_items (id, order_id, product_reference, brand_id, category_id, title, size, original_price_paise, image, quantity, status)
    VALUES (
      '55555555-5555-5555-5555-555555555555',
      'o-105',
      'ROADSTER-SHIRT-005',
      brand_roadster,
      cat_shirts,
      'Casual Solid Cotton Shirt',
      'M',
      249900, -- ₹2,499 in paise
      'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&q=80&w=400',
      1,
      'delivered'
    );

    -- Evaluate Eligibility decisions
    -- 1. o-101 Puffer: Original Price > 3000, age < 3 yr => Eligible
    INSERT INTO public.eligibility_decisions (order_item_id, eligible, rule_version, reason_code)
    VALUES ('11111111-1111-1111-1111-111111111111', TRUE, 'v1', 'passed_rules');

    -- 2. o-102 Nike: Original Price > 3000, age < 3 yr => Eligible
    INSERT INTO public.eligibility_decisions (order_item_id, eligible, rule_version, reason_code)
    VALUES ('22222222-2222-2222-2222-222222222222', TRUE, 'v1', 'passed_rules');

    -- 3. o-103 Zara Skirt: Original Price > 3000, age < 3 yr => Eligible
    INSERT INTO public.eligibility_decisions (order_item_id, eligible, rule_version, reason_code)
    VALUES ('33333333-3333-3333-3333-333333333333', TRUE, 'v1', 'passed_rules');

    -- 4. o-104 Levis: Original Price > 3000, age < 3 yr => Eligible
    INSERT INTO public.eligibility_decisions (order_item_id, eligible, rule_version, reason_code)
    VALUES ('44444444-4444-4444-4444-444444444444', TRUE, 'v1', 'passed_rules');

    -- 5. o-105 Roadster Shirt: Original Price (2499) <= 3000 => Ineligible!
    INSERT INTO public.eligibility_decisions (order_item_id, eligible, rule_version, reason_code)
    VALUES ('55555555-5555-5555-5555-555555555555', FALSE, 'v1', 'price_below_minimum_threshold');
    
  END IF;
END;
$$ LANGUAGE plpgsql;
