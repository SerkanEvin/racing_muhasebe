import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { HelpTooltip } from '../components/HelpTooltip';
import { Plus, Package, ShoppingCart, Edit, Trash2 } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  category: string;
  unit_price: number;
  stock_quantity: number;
}

interface SaleOrder {
  id: string;
  member_name: string;
  order_date: string;
  total_amount: number;
  payment_status: string;
  payment_method: string;
}

export function MerchSales() {
  const [activeTab, setActiveTab] = useState<'products' | 'sales'>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<SaleOrder[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showSaleModal, setShowSaleModal] = useState(false);

  const [productForm, setProductForm] = useState({
    name: '',
    category: '',
    unit_price: 0,
    stock_quantity: 0,
  });

  const [saleForm, setSaleForm] = useState({
    member_id: '',
    order_date: new Date().toISOString().split('T')[0],
    payment_method: 'unpaid',
    payment_status: 'unpaid',
    items: [] as Array<{ product_id: string; quantity: number; unit_price: number }>,
  });

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    await loadProducts();
    await loadSales();
    await loadMembers();
    setLoading(false);
  };

  const loadProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('*')
      .order('name');
    setProducts(data || []);
  };

  const loadSales = async () => {
    const { data } = await supabase
      .from('sales_orders')
      .select(`
        *,
        members(full_name)
      `)
      .order('order_date', { ascending: false });

    const salesWithNames = data?.map(sale => ({
      ...sale,
      member_name: (sale.members as any)?.full_name || 'Unknown',
    })) || [];

    setSales(salesWithNames);
  };

  const loadMembers = async () => {
    const { data } = await supabase
      .from('members')
      .select('*')
      .is('leave_date', null)
      .order('full_name');
    setMembers(data || []);
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('products').insert([productForm]);
      if (error) throw error;

      setShowProductModal(false);
      setProductForm({ name: '', category: '', unit_price: 0, stock_quantity: 0 });
      loadProducts();
    } catch (error) {
      console.error('Error adding product:', error);
      alert('Error adding product');
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Delete this product?')) return;

    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      loadProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Error deleting product');
    }
  };

  const handleCreateSale = async (e: React.FormEvent) => {
    e.preventDefault();

    if (saleForm.items.length === 0) {
      alert('Please add at least one item');
      return;
    }

    try {
      const total = saleForm.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

      const { data: orderData, error: orderError } = await supabase
        .from('sales_orders')
        .insert([{
          member_id: saleForm.member_id,
          order_date: saleForm.order_date,
          payment_method: saleForm.payment_method,
          payment_status: saleForm.payment_status,
          total_amount: total,
        }])
        .select()
        .single();

      if (orderError) throw orderError;

      const items = saleForm.items.map(item => {
        const product = products.find(p => p.id === item.product_id);
        return {
          order_id: orderData.id,
          product_id: item.product_id,
          product_name: product?.name || '',
          quantity: item.quantity,
          unit_price: item.unit_price,
          line_total: item.quantity * item.unit_price,
        };
      });

      const { error: itemsError } = await supabase.from('sales_order_items').insert(items);
      if (itemsError) throw itemsError;

      for (const item of saleForm.items) {
        const product = products.find(p => p.id === item.product_id);
        if (product) {
          await supabase
            .from('products')
            .update({ stock_quantity: product.stock_quantity - item.quantity })
            .eq('id', item.product_id);
        }
      }

      if (saleForm.payment_status === 'paid') {
        await supabase.from('transactions_ledger').insert({
          txn_date: saleForm.order_date,
          txn_type: 'merch_sale',
          amount: total,
          member_id: saleForm.member_id,
          project: 'General',
          category: 'merch',
          description: `Merch sale`,
          source: saleForm.payment_method,
          reference_type: 'sale_order',
          reference_id: orderData.id,
        });
      }

      setShowSaleModal(false);
      setSaleForm({
        member_id: '',
        order_date: new Date().toISOString().split('T')[0],
        payment_method: 'unpaid',
        payment_status: 'unpaid',
        items: [],
      });
      loadSales();
      loadProducts();
    } catch (error) {
      console.error('Error creating sale:', error);
      alert('Error creating sale');
    }
  };

  const addItemToSale = () => {
    if (products.length === 0) return;

    const firstProduct = products[0];
    setSaleForm({
      ...saleForm,
      items: [
        ...saleForm.items,
        { product_id: firstProduct.id, quantity: 1, unit_price: firstProduct.unit_price },
      ],
    });
  };

  const removeItemFromSale = (index: number) => {
    setSaleForm({
      ...saleForm,
      items: saleForm.items.filter((_, i) => i !== index),
    });
  };

  const updateSaleItem = (index: number, field: string, value: any) => {
    const newItems = [...saleForm.items];
    newItems[index] = { ...newItems[index], [field]: value };

    if (field === 'product_id') {
      const product = products.find(p => p.id === value);
      if (product) {
        newItems[index].unit_price = product.unit_price;
      }
    }

    setSaleForm({ ...saleForm, items: newItems });
  };

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center">
          Merch Sales
          <HelpTooltip text="Manage inventory and record merchandise sales to members" />
        </h2>
        <div className="flex gap-2">
          {activeTab === 'products' && (
            <button
              onClick={() => setShowProductModal(true)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Product
            </button>
          )}
          {activeTab === 'sales' && (
            <button
              onClick={() => setShowSaleModal(true)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              Create Sale
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('products')}
              className={`px-6 py-3 text-sm font-medium ${
                activeTab === 'products'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Package className="w-4 h-4 inline mr-2" />
              Products & Inventory
            </button>
            <button
              onClick={() => setActiveTab('sales')}
              className={`px-6 py-3 text-sm font-medium ${
                activeTab === 'sales'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <ShoppingCart className="w-4 h-4 inline mr-2" />
              Sales History
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'products' && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Product Name
                      <HelpTooltip text="Name of the merchandise item" />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Category
                      <HelpTooltip text="Product category or type" />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Unit Price
                      <HelpTooltip text="Price per item in TL" />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Stock
                      <HelpTooltip text="Available quantity in inventory" />
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {products.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                        No products yet. Add your first product to start tracking inventory.
                      </td>
                    </tr>
                  ) : (
                    products.map((product) => (
                      <tr key={product.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{product.name}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-500">{product.category}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-semibold text-gray-900">{product.unit_price.toFixed(2)} TL</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className={`text-sm font-medium ${product.stock_quantity <= 5 ? 'text-red-600' : 'text-gray-900'}`}>
                            {product.stock_quantity}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-medium">
                          <button
                            onClick={() => handleDeleteProduct(product.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'sales' && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Member
                      <HelpTooltip text="Member who made the purchase" />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Date
                      <HelpTooltip text="Purchase date" />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Total Amount
                      <HelpTooltip text="Total sale amount in TL" />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Payment Status
                      <HelpTooltip text="Whether payment has been received" />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Payment Method
                      <HelpTooltip text="How the payment was made" />
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sales.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                        No sales yet. Create your first sale to start tracking.
                      </td>
                    </tr>
                  ) : (
                    sales.map((sale) => (
                      <tr key={sale.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{sale.member_name}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-500">{new Date(sale.order_date).toLocaleDateString()}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-semibold text-gray-900">{parseFloat(String(sale.total_amount)).toFixed(2)} TL</div>
                        </td>
                        <td className="px-6 py-4">
                          {sale.payment_status === 'paid' ? (
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                              Paid
                            </span>
                          ) : (
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                              Unpaid
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-500">{sale.payment_method}</div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showProductModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              Add New Product
              <HelpTooltip text="Add a new merchandise item to your inventory" />
            </h3>
            <form onSubmit={handleAddProduct} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                <input
                  type="text"
                  required
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <input
                  type="text"
                  required
                  value={productForm.category}
                  onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price (TL)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={productForm.unit_price}
                  onChange={(e) => setProductForm({ ...productForm, unit_price: parseFloat(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Initial Stock Quantity</label>
                <input
                  type="number"
                  required
                  value={productForm.stock_quantity}
                  onChange={(e) => setProductForm({ ...productForm, stock_quantity: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Add Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSaleModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              Create New Sale
              <HelpTooltip text="Record a merchandise sale to a member" />
            </h3>
            <form onSubmit={handleCreateSale} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Member</label>
                  <select
                    required
                    value={saleForm.member_id}
                    onChange={(e) => setSaleForm({ ...saleForm, member_id: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Select member</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>{m.full_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sale Date</label>
                  <input
                    type="date"
                    required
                    value={saleForm.order_date}
                    onChange={(e) => setSaleForm({ ...saleForm, order_date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-medium text-gray-900">Line Items</h4>
                  <button
                    type="button"
                    onClick={addItemToSale}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    + Add Item
                  </button>
                </div>
                {saleForm.items.map((item, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 mb-2">
                    <div className="col-span-5">
                      <select
                        value={item.product_id}
                        onChange={(e) => updateSaleItem(index, 'product_id', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      >
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateSaleItem(index, 'quantity', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="Qty"
                      />
                    </div>
                    <div className="col-span-3">
                      <input
                        type="number"
                        step="0.01"
                        value={item.unit_price}
                        onChange={(e) => updateSaleItem(index, 'unit_price', parseFloat(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="Price"
                      />
                    </div>
                    <div className="col-span-2 flex items-center justify-between">
                      <span className="text-sm font-medium">{(item.quantity * item.unit_price).toFixed(2)}</span>
                      <button
                        type="button"
                        onClick={() => removeItemFromSale(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Status</label>
                  <select
                    value={saleForm.payment_status}
                    onChange={(e) => setSaleForm({ ...saleForm, payment_status: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="unpaid">Unpaid</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                  <select
                    value={saleForm.payment_method}
                    onChange={(e) => setSaleForm({ ...saleForm, payment_method: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="unpaid">Unpaid</option>
                    <option value="cash">Cash</option>
                    <option value="bank">Bank Transfer</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowSaleModal(false);
                    setSaleForm({
                      member_id: '',
                      order_date: new Date().toISOString().split('T')[0],
                      payment_method: 'unpaid',
                      payment_status: 'unpaid',
                      items: [],
                    });
                  }}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create Sale
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
