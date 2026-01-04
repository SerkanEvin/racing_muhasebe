import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { HelpTooltip } from '../components/HelpTooltip';
import { Save, RefreshCw } from 'lucide-react';

export function Settings() {
  const [settings, setSettings] = useState({
    membership_fee_amount: 200,
    default_categories: ['materials', 'travel', 'event', 'food', 'other'],
    default_projects: ['Corsa', 'Doruk', 'General'],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

      if (data) {
        setSettings({
          membership_fee_amount: parseFloat(data.membership_fee_amount),
          default_categories: data.default_categories || settings.default_categories,
          default_projects: data.default_projects || settings.default_projects,
        });
      }
      setLoading(false);
    } catch (error) {
      console.error('Error loading settings:', error);
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('settings')
        .upsert({
          id: 1,
          membership_fee_amount: settings.membership_fee_amount,
          default_categories: settings.default_categories,
          default_projects: settings.default_projects,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
      alert('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Error saving settings');
    }
    setSaving(false);
  };

  const addDemoData = async () => {
    if (!confirm('Add demo data for testing? This will create sample members, products, and transactions.')) {
      return;
    }

    try {
      const demoMembers = [
        { full_name: 'Ahmet Yılmaz', join_date: '2024-01-15', notes: 'Team lead' },
        { full_name: 'Ayşe Demir', join_date: '2024-02-01', notes: 'Electronics' },
        { full_name: 'Mehmet Kaya', join_date: '2024-01-20', notes: 'Mechanical' },
      ];

      await supabase.from('members').insert(demoMembers);

      const demoProducts = [
        { name: 'Team T-Shirt', category: 'apparel', unit_price: 150, stock_quantity: 50 },
        { name: 'Racing Jacket', category: 'apparel', unit_price: 400, stock_quantity: 20 },
        { name: 'Sticker Pack', category: 'accessories', unit_price: 25, stock_quantity: 100 },
      ];

      await supabase.from('products').insert(demoProducts);

      alert('Demo data added successfully!');
    } catch (error) {
      console.error('Error adding demo data:', error);
      alert('Error adding demo data');
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading settings...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center">
          Settings
          <HelpTooltip text="Configure application settings and defaults" />
        </h2>
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Membership Settings</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
              Monthly Membership Fee (TL)
              <HelpTooltip text="Default monthly fee amount for all active members" />
            </label>
            <input
              type="number"
              step="0.01"
              value={settings.membership_fee_amount}
              onChange={(e) => setSettings({ ...settings, membership_fee_amount: parseFloat(e.target.value) })}
              className="w-full max-w-xs px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Default Categories</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
              Expense Categories
              <HelpTooltip text="Default expense categories shown in dropdowns" />
            </label>
            <input
              type="text"
              value={settings.default_categories.join(', ')}
              onChange={(e) => setSettings({
                ...settings,
                default_categories: e.target.value.split(',').map(s => s.trim())
              })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="materials, travel, event, food, other"
            />
            <p className="text-xs text-gray-500 mt-1">Comma-separated list</p>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Default Projects</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
              Project / Cost Centers
              <HelpTooltip text="Default projects or cost centers for expense allocation" />
            </label>
            <input
              type="text"
              value={settings.default_projects.join(', ')}
              onChange={(e) => setSettings({
                ...settings,
                default_projects: e.target.value.split(',').map(s => s.trim())
              })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Corsa, Doruk, General"
            />
            <p className="text-xs text-gray-500 mt-1">Comma-separated list</p>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-6 flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Developer Tools</h3>
        <div className="space-y-4">
          <div>
            <button
              onClick={addDemoData}
              className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Add Demo Data
            </button>
            <p className="text-sm text-gray-500 mt-2">
              Adds sample members, products, and transactions for testing purposes.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Sample Member JSON Format</h3>
        <div className="bg-gray-50 rounded-lg p-4">
          <pre className="text-xs text-gray-700 overflow-x-auto">
{`[
  {
    "full_name": "John Doe",
    "join_date": "2024-01-15",
    "notes": "Team member notes"
  },
  {
    "full_name": "Jane Smith",
    "join_date": "2024-02-01",
    "notes": "Optional notes"
  }
]`}
          </pre>
        </div>
        <p className="text-sm text-gray-500 mt-2">
          Use this format when importing members via JSON. The import will automatically skip duplicates based on name.
        </p>
      </div>
    </div>
  );
}
