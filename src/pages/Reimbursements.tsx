import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { HelpTooltip } from '../components/HelpTooltip';
import { Plus, CheckCircle, XCircle } from 'lucide-react';

interface Reimbursement {
  id: string;
  member_id: string;
  member_name: string;
  purchase_date: string;
  vendor: string;
  description: string;
  amount: number;
  category: string;
  project: string;
  payment_status: string;
  payment_date: string | null;
  payment_method: string | null;
  receipt_note: string;
}

export function Reimbursements() {
  const [reimbursements, setReimbursements] = useState<Reimbursement[]>([]);
  const [filteredReimbursements, setFilteredReimbursements] = useState<Reimbursement[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'unpaid'>('all');

  const [formData, setFormData] = useState({
    member_id: '',
    purchase_date: new Date().toISOString().split('T')[0],
    vendor: '',
    description: '',
    amount: 0,
    category: 'other',
    project: 'General',
    receipt_note: '',
    receipt_date: '',
    receipt_no: '',
    receipt_text: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterData();
  }, [reimbursements, filterStatus]);

  const loadData = async () => {
    try {
      const { data: reimbData } = await supabase
        .from('reimbursements')
        .select(`
          *,
          members(full_name)
        `)
        .order('purchase_date', { ascending: false });

      const reimbWithNames = reimbData?.map(r => ({
        ...r,
        member_name: (r.members as any).full_name,
      })) || [];

      setReimbursements(reimbWithNames);

      const { data: membersData } = await supabase
        .from('members')
        .select('*')
        .is('leave_date', null)
        .order('full_name');

      setMembers(membersData || []);
      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      setLoading(false);
    }
  };

  const filterData = () => {
    let filtered = reimbursements;

    if (filterStatus === 'paid') {
      filtered = filtered.filter(r => r.payment_status === 'paid');
    } else if (filterStatus === 'unpaid') {
      filtered = filtered.filter(r => r.payment_status === 'unpaid');
    }

    setFilteredReimbursements(filtered);
  };

  const handleAddReimbursement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('reimbursements').insert([{
        ...formData,
        payment_status: 'unpaid',
      }]);

      if (error) throw error;

      setShowAddModal(false);
      setFormData({
        member_id: '',
        purchase_date: new Date().toISOString().split('T')[0],
        vendor: '',
        description: '',
        amount: 0,
        category: 'other',
        project: 'General',
        receipt_note: '',
        receipt_date: '',
        receipt_no: '',
        receipt_text: '',
      });
      loadData();
    } catch (error) {
      console.error('Error adding reimbursement:', error);
      alert('Error adding reimbursement');
    }
  };

  const handleMarkPaid = async (reimbursementId: string) => {
    const paymentMethod = prompt('Payment method (bank/cash/other):');
    if (!paymentMethod) return;

    try {
      const { error } = await supabase
        .from('reimbursements')
        .update({
          payment_status: 'paid',
          payment_method: paymentMethod,
          payment_date: new Date().toISOString().split('T')[0],
        })
        .eq('id', reimbursementId);

      if (error) throw error;

      const reimb = reimbursements.find(r => r.id === reimbursementId);
      if (reimb) {
        await supabase.from('transactions_ledger').insert({
          txn_date: new Date().toISOString().split('T')[0],
          txn_type: 'reimbursement_payment',
          amount: -reimb.amount,
          member_id: reimb.member_id,
          project: reimb.project,
          category: reimb.category,
          description: `Reimbursement paid: ${reimb.description}`,
          source: paymentMethod,
          reference_type: 'reimbursement',
          reference_id: reimbursementId,
        });
      }

      loadData();
    } catch (error) {
      console.error('Error marking paid:', error);
      alert('Error updating payment status');
    }
  };

  const totalPending = filteredReimbursements
    .filter(r => r.payment_status === 'unpaid')
    .reduce((sum, r) => sum + parseFloat(String(r.amount)), 0);

  if (loading) {
    return <div className="text-center py-12">Loading reimbursements...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center">
          Reimbursements
          <HelpTooltip text="Track member purchases for the team that need reimbursement" />
        </h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Reimbursement
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Filter:</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="all">All</option>
              <option value="unpaid">Unpaid</option>
              <option value="paid">Paid</option>
            </select>
          </div>
          <div className="flex-1 flex items-center gap-4">
            <div className="text-sm">
              <span className="text-gray-600">Pending Total:</span>
              <span className="ml-2 font-semibold text-red-600">{totalPending.toFixed(2)} TL</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
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
                  Description
                  <HelpTooltip text="What was purchased" />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Vendor
                  <HelpTooltip text="Where it was purchased" />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Amount
                  <HelpTooltip text="Reimbursement amount in TL" />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Category
                  <HelpTooltip text="Expense category" />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Project
                  <HelpTooltip text="Project or cost center" />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                  <HelpTooltip text="Payment status" />
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredReimbursements.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                    No reimbursements found. Add reimbursements when members purchase items for the team.
                  </td>
                </tr>
              ) : (
                filteredReimbursements.map((reimb) => (
                  <tr key={reimb.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{reimb.member_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{new Date(reimb.purchase_date).toLocaleDateString()}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs truncate">{reimb.description}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{reimb.vendor || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">{parseFloat(String(reimb.amount)).toFixed(2)} TL</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{reimb.category}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{reimb.project}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {reimb.payment_status === 'paid' ? (
                        <span className="px-2 inline-flex items-center text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Paid
                        </span>
                      ) : (
                        <span className="px-2 inline-flex items-center text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                          <XCircle className="w-3 h-3 mr-1" />
                          Unpaid
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {reimb.payment_status === 'unpaid' && (
                        <button
                          onClick={() => handleMarkPaid(reimb.id)}
                          className="text-green-600 hover:text-green-900"
                        >
                          Mark Paid
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              Add Reimbursement
              <HelpTooltip text="Record a purchase made by a member that needs to be reimbursed" />
            </h3>
            <form onSubmit={handleAddReimbursement} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                    Member
                    <HelpTooltip text="Member who made the purchase" />
                  </label>
                  <select
                    required
                    value={formData.member_id}
                    onChange={(e) => setFormData({ ...formData, member_id: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Select member</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>{m.full_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                    Purchase Date
                    <HelpTooltip text="Date of purchase" />
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.purchase_date}
                    onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                  Description
                  <HelpTooltip text="What was purchased and why" />
                </label>
                <textarea
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                    Vendor
                    <HelpTooltip text="Where the purchase was made (optional)" />
                  </label>
                  <input
                    type="text"
                    value={formData.vendor}
                    onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                    Amount (TL)
                    <HelpTooltip text="Reimbursement amount" />
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                    Category
                    <HelpTooltip text="Type of expense" />
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="materials">Materials</option>
                    <option value="travel">Travel</option>
                    <option value="event">Event</option>
                    <option value="food">Food</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                    Project
                    <HelpTooltip text="Which project or cost center" />
                  </label>
                  <input
                    type="text"
                    value={formData.project}
                    onChange={(e) => setFormData({ ...formData, project: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Corsa, Doruk, General"
                  />
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                  Receipt Information (Optional)
                  <HelpTooltip text="Store receipt metadata. No file upload required." />
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Receipt No.</label>
                    <input
                      type="text"
                      value={formData.receipt_no}
                      onChange={(e) => setFormData({ ...formData, receipt_no: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Receipt Date</label>
                    <input
                      type="date"
                      value={formData.receipt_date}
                      onChange={(e) => setFormData({ ...formData, receipt_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none"
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="block text-sm text-gray-600 mb-1">Receipt Notes</label>
                  <textarea
                    value={formData.receipt_note}
                    onChange={(e) => setFormData({ ...formData, receipt_note: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none"
                    rows={2}
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Add Reimbursement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
