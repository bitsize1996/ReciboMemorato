# Public Memory Gallery + Private Sales & Costing Dashboard

The public site and gallery design stay as they are. A new private admin area is added with its own clean, functional look.

## Part 1 — Public gallery (mostly in place, tightened)
- /memories and /memories/<slug> stay open to everyone: no login needed.
- Only published events, enabled tabs, and approved files show up. Downloads appear only where the owner allowed them.
- Public responses leave out folder IDs, Drive file IDs, and internal flags. The server re-checks every download.
- Owners can create, edit, archive, and delete events (name, date, place, cover, the four folders, publish on/off) only from inside the admin area.

## Part 2 — Private admin area at /admin
Sidebar: Overview, Sales, Packages, Materials, Expenses, Gallery, Settings. You must be signed in, and the database also checks the admin role on every private table. Money is shown in ₱ throughout.

- **Overview**: Total sales, total costs, total profit, number of sales, this month's sales, and this month's profit. Filter by Today, Week, Month, Year, or a custom range. Every number comes from real records. When there are none, it says "No sales recorded yet."
- **Materials**: name, category, unit, cost per unit, supplier, optional stock and minimum stock, active/inactive.
- **Packages**: name, description, selling price, active/inactive, included services, notes, and a list of the materials it uses (material + quantity). Material cost and profit are worked out automatically. Estimated other costs are entered by hand, and the page shows estimated profit and margin.
- **Sales**: a "+ Add sale" form with customer, contact, event name and date, booking date, package, quantity, selling price, discount, amount paid, balance (worked out automatically), payment status (Unpaid, Partially Paid, Fully Paid, Refunded, Cancelled), and notes. Picking a package fills in its materials using today's costs, and you can still edit them.
- **Sale detail page**: revenue, material costs, and other expenses in separate sections. It also has "+ Add expense" (name, category, amount, date, notes) and shows net profit and margin.
- **Sales table**: search, sort, and filters for date, package, and payment status. Click any row to open its full breakdown.
- **Expenses**: all expenses from every sale in one list, with filters. Categories include Transportation, Labor, Food, Equipment, Rental, Delivery, and Miscellaneous, and you can type your own.
- **Reports**: sales, costs, and profit summaries with date filters and simple charts.
- **Gallery**: the existing event and gallery management, moved inside the new sidebar.
- **Settings**: account details and sign out.

## Key business rules
- Net revenue = selling price - discount
- Material cost = total of the sale's materials, using the cost saved when the sale was recorded
- Other expenses = total of the sale's expenses
- Net profit = net revenue - material cost - other expenses
- Margin = profit / net revenue x 100, showing a dash when revenue is 0
- Changing a material's price only affects package estimates and future sales. Past sales keep their saved costs.
- No fake data is created.

## Technical details
- Migration adds these tables: materials, packages, package_materials, sales (sale_number serial for "#0001", booking_date, event_date, event_name, optional event_id, package_id, quantity, selling_price, discount, amount_paid, payment_status enum, notes), sale_materials (quantity, unit_cost_snapshot, total_cost), and sale_expenses (category text, description, amount, date, notes). It also adds estimated_other_costs, included_services, and notes to packages, and archived to events.
- All money columns use numeric(12,2). Every table gets RLS with admin-only access via has_role, grants for authenticated and service_role only, and no anon access. updated_at triggers are included.
- Server functions go in src/lib/business.functions.ts, each using requireSupabaseAuth + assertAdmin. Totals are calculated in shared helpers in src/lib/finance.ts.
- Routes: _authenticated/admin/route.tsx (sidebar layout plus an admin check that shows a claim/forbidden screen), then index (overview), sales, sales.$saleId, packages, materials, expenses, reports, gallery (the existing events list), gallery.$eventId, and settings. The old /admin/events redirects to /admin/gallery.
- Charts use recharts. The admin styles are separate, neutral design tokens scoped under .admin-shell.
- The public event query functions are reviewed so they return only the fields the gallery displays.
