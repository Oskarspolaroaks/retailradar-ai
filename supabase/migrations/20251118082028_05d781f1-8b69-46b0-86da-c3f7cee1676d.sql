-- Add INSERT policies for competitors table
CREATE POLICY "Admins can insert competitors"
ON public.competitors
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add UPDATE policies for competitors table
CREATE POLICY "Admins can update competitors"
ON public.competitors
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add DELETE policies for competitors table
CREATE POLICY "Admins can delete competitors"
ON public.competitors
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add INSERT policies for competitor_product_mapping table
CREATE POLICY "Admins can insert mappings"
ON public.competitor_product_mapping
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add UPDATE policies for competitor_product_mapping table
CREATE POLICY "Admins can update mappings"
ON public.competitor_product_mapping
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add DELETE policies for competitor_product_mapping table
CREATE POLICY "Admins can delete mappings"
ON public.competitor_product_mapping
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add INSERT policies for competitor_prices table
CREATE POLICY "Admins can insert competitor prices"
ON public.competitor_prices
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add UPDATE policies for competitor_prices table
CREATE POLICY "Admins can update competitor prices"
ON public.competitor_prices
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add DELETE policies for competitor_prices table
CREATE POLICY "Admins can delete competitor prices"
ON public.competitor_prices
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add INSERT policies for products table
CREATE POLICY "Admins can insert products"
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add UPDATE policies for products table
CREATE POLICY "Admins can update products"
ON public.products
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add DELETE policies for products table
CREATE POLICY "Admins can delete products"
ON public.products
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add INSERT policies for sales table
CREATE POLICY "Admins can insert sales"
ON public.sales
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add UPDATE policies for sales table
CREATE POLICY "Admins can update sales"
ON public.sales
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add DELETE policies for sales table
CREATE POLICY "Admins can delete sales"
ON public.sales
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add INSERT policies for price_recommendations table
CREATE POLICY "Admins can insert recommendations"
ON public.price_recommendations
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add UPDATE policies for price_recommendations table
CREATE POLICY "Admins can update recommendations"
ON public.price_recommendations
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add DELETE policies for price_recommendations table
CREATE POLICY "Admins can delete recommendations"
ON public.price_recommendations
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add INSERT policies for alerts table
CREATE POLICY "System can insert alerts"
ON public.alerts
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Add DELETE policies for alerts table
CREATE POLICY "Authenticated users can delete alerts"
ON public.alerts
FOR DELETE
TO authenticated
USING (true);