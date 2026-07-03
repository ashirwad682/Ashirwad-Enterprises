import express from 'express';

export default function createProductSlabRouter({ supabase, requireAdminKey }) {
  const router = express.Router({ mergeParams: true });

  // List slabs for a product
  router.get('/', requireAdminKey, async (req, res) => {
    const { productId } = req.params;
    const { data, error } = await supabase
      .from('product_slabs')
      .select('*')
      .eq('product_id', productId)
      .order('min_quantity', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  });

  // Create a new slab for a product
  router.post('/', requireAdminKey, async (req, res) => {
    const { productId } = req.params;
    const { min_quantity, discount_type, discount_value, start_date, end_date } = req.body;
    if (!min_quantity || !discount_type || discount_value == null || !start_date || !end_date) {
      return res.status(400).json({ error: 'All fields required' });
    }
    const { data, error } = await supabase
      .from('product_slabs')
      .insert([{ product_id: productId, min_quantity, discount_type, discount_value, start_date, end_date }])
      .select()
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
  });

  // Update a slab
  router.put('/:slabId', requireAdminKey, async (req, res) => {
    const { productId, slabId } = req.params;
    const { min_quantity, discount_type, discount_value, start_date, end_date } = req.body;
    const { data, error } = await supabase
      .from('product_slabs')
      .update({ min_quantity, discount_type, discount_value, start_date, end_date })
      .eq('id', slabId)
      .eq('product_id', productId)
      .select()
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  // Delete a slab
  router.delete('/:slabId', requireAdminKey, async (req, res) => {
    const { productId, slabId } = req.params;
    const { error } = await supabase
      .from('product_slabs')
      .delete()
      .eq('id', slabId)
      .eq('product_id', productId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  return router;
}
