CREATE TYPE public.payment_status AS ENUM ('unpaid','partially_paid','fully_paid','refunded','cancelled');

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

CREATE TABLE public.materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text,
  unit text NOT NULL DEFAULT 'pc',
  current_unit_cost numeric(12,2) NOT NULL DEFAULT 0,
  supplier text,
  current_stock numeric(12,2),
  min_stock numeric(12,2),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  selling_price numeric(12,2) NOT NULL DEFAULT 0,
  estimated_other_costs numeric(12,2) NOT NULL DEFAULT 0,
  included_services text,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.package_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.materials(id) ON DELETE RESTRICT,
  quantity numeric(12,2) NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_number serial UNIQUE,
  customer_name text NOT NULL,
  customer_contact text,
  event_name text,
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  package_id uuid REFERENCES public.packages(id) ON DELETE SET NULL,
  package_name_snapshot text,
  booking_date date NOT NULL DEFAULT CURRENT_DATE,
  event_date date,
  quantity integer NOT NULL DEFAULT 1,
  selling_price numeric(12,2) NOT NULL DEFAULT 0,
  discount numeric(12,2) NOT NULL DEFAULT 0,
  amount_paid numeric(12,2) NOT NULL DEFAULT 0,
  payment_status public.payment_status NOT NULL DEFAULT 'unpaid',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sale_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  material_id uuid REFERENCES public.materials(id) ON DELETE SET NULL,
  material_name_snapshot text NOT NULL,
  quantity numeric(12,2) NOT NULL DEFAULT 1,
  unit_cost_snapshot numeric(12,2) NOT NULL DEFAULT 0,
  total_cost numeric(12,2) GENERATED ALWAYS AS (quantity * unit_cost_snapshot) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sale_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'Miscellaneous',
  description text NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON public.package_materials(package_id);
CREATE INDEX ON public.sale_materials(sale_id);
CREATE INDEX ON public.sale_expenses(sale_id);
CREATE INDEX ON public.sales(booking_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.materials, public.packages, public.package_materials, public.sales, public.sale_materials, public.sale_expenses TO authenticated;
GRANT ALL ON public.materials, public.packages, public.package_materials, public.sales, public.sale_materials, public.sale_expenses TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.sales_sale_number_seq TO authenticated, service_role;

ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage materials" ON public.materials FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage packages" ON public.packages FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage package materials" ON public.package_materials FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage sales" ON public.sales FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage sale materials" ON public.sale_materials FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage sale expenses" ON public.sale_expenses FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER materials_set_updated_at BEFORE UPDATE ON public.materials FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER packages_set_updated_at BEFORE UPDATE ON public.packages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER sales_set_updated_at BEFORE UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();