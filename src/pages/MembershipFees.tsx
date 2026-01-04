import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { HelpTooltip } from '../components/HelpTooltip';
import { Plus, CheckCircle, XCircle, Calendar } from 'lucide-react';

interface MembershipFee {
  id: string;
  member_id: string;
  member_name: string;
  fee_month: string;
  amount: number;
  payment_status: string;
  payment_method: string | null;
  payment_date: string | null;
  notes: string;
}

export function MembershipFees() {
  const [fees, setFees] = useState<MembershipFee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );
  const [feeAmount, setFeeAmount] = useState(200);

  useEffect(() => {
    loadFeeAmount();
    loadFees();
  }, [selectedMonth]);

  const loadFeeAmount = async () => {
    const { data } = await supabase
      .from('settings')
      .select('membership_fee_amount')
      .eq('id', 1)
      .maybeSingle();

    if (data) {
      setFeeAmount(parseFloat(data.membership_fee_amount));
    }
  };

  const loadFees = async () => {
    try {
      const monthStart = `${selectedMonth}-01`;

      const { data, error } = await supabase
        .from('membership_fees')
        .select(`
          *,
          members!inner(full_name)
        `)
        .gte('fee_month', monthStart)
        .lt('fee_month', new Date(new Date(monthStart).setMonth(new Date(monthStart).getMonth() + 1)).toISOString().split('T')[0]);

      if (error) throw error;

      const feesWithNames = data?.map(fee => ({
        ...fee,
        member_name: (fee.members as any).full_name,
      })) || [];

      setFees(feesWithNames);
      setLoading(false);
    } catch (error) {
      console.error('Error loading fees:', error);
      setLoading(false);
    }
  };

  const handleGenerateFees = async () => {
    if (!confirm(`Generate membership fees (${feeAmount} TL) for all active members in ${selectedMonth}?`)) {
      return;
    }

    try {
      const monthDate = new Date(`${selectedMonth}-01`);
      const monthStart = monthDate.toISOString().split('T')[0];

      const { data: activeMembers } = await supabase
        .from('members')
        .select('*')
        .lte('join_date', monthDate.toISOString().split('T')[0])
        .or(`leave_date.is.null,leave_date.gte.${monthStart}`);

      if (!activeMembers || activeMembers.length === 0) {
        alert('No active members found for this month');
        return;
      }

      const feesToInsert = activeMembers.map(member => ({
        member_id: member.id,
        fee_month: monthStart,
        amount: feeAmount,
        payment_status: 'unpaid',
      }));

      const { error } = await supabase
        .from('membership_fees')
        .upsert(feesToInsert, { onConflict: 'member_id,fee_month', ignoreDuplicates: true });

      if (error) throw error;

      alert(`Generated fees for ${activeMembers.length} members`);
      loadFees();
    } catch (error) {
      console.error('Error generating fees:', error);
      alert('Error generating fees');
    }
  };

  const handleMarkPaid = async (feeId: string) => {
    const paymentMethod = prompt('Payment method (bank/cash/other):');
    if (!paymentMethod) return;

    try {
      const { error } = await supabase
        .from('membership_fees')
        .update({
          payment_status: 'paid',
          payment_method: paymentMethod,
          payment_date: new Date().toISOString().split('T')[0],
        })
        .eq('id', feeId);

      if (error) throw error;

      const fee = fees.find(f => f.id === feeId);
      if (fee) {
        await supabase.from('transactions_ledger').insert({
          txn_date: new Date().toISOString().split('T')[0],
          txn_type: 'membership_fee_payment',
          amount: fee.amount,
          member_id: fee.member_id,
          project: 'General',
          category: 'membership',
          description: `Membership fee payment for ${selectedMonth} - ${fee.member_name}`,
          source: paymentMethod,
          reference_type: 'membership_fee',
          reference_id: feeId,
        });
      }

      loadFees();
    } catch (error) {
      console.error('Error marking paid:', error);
      alert('Error updating payment status');
    }
  };

  const totalFees = fees.reduce((sum, f) => sum + parseFloat(String(f.amount)), 0);
  const totalPaid = fees.filter(f => f.payment_status === 'paid').reduce((sum, f) => sum + parseFloat(String(f.amount)), 0);
  const totalUnpaid = totalFees - totalPaid;

  if (loading) {
    return <div className="text-center py-12">Loading fees...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center">
          Membership Fees
          <HelpTooltip text="Generate and track monthly membership fees for active members" />
        </h2>
        <button
          onClick={handleGenerateFees}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Generate Fees
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-400" />
            <label className="text-sm font-medium text-gray-700 flex items-center">
              Month
              <HelpTooltip text="Select month to view and manage fees" />
            </label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
          <div className="flex-1 flex gap-4 text-sm">
            <div>
              <span className="text-gray-600">Total:</span>
              <span className="ml-2 font-semibold text-gray-900">{totalFees.toFixed(2)} TL</span>
            </div>
            <div>
              <span className="text-gray-600">Paid:</span>
              <span className="ml-2 font-semibold text-green-600">{totalPaid.toFixed(2)} TL</span>
            </div>
            <div>
              <span className="text-gray-600">Unpaid:</span>
              <span className="ml-2 font-semibold text-red-600">{totalUnpaid.toFixed(2)} TL</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Member
                  <HelpTooltip text="Team member name" />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Month
                  <HelpTooltip text="Fee month" />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                  <HelpTooltip text="Monthly fee amount in TL" />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                  <HelpTooltip text="Payment status (paid/unpaid)" />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment Method
                  <HelpTooltip text="How the fee was paid" />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment Date
                  <HelpTooltip text="When the fee was paid" />
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {fees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    No fees found for this month. Click "Generate Fees" to create fees for active members.
                  </td>
                </tr>
              ) : (
                fees.map((fee) => (
                  <tr key={fee.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{fee.member_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {new Date(fee.fee_month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">{parseFloat(String(fee.amount)).toFixed(2)} TL</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {fee.payment_status === 'paid' ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Paid
                        </span>
                      ) : (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                          <XCircle className="w-3 h-3 mr-1" />
                          Unpaid
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{fee.payment_method || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {fee.payment_date ? new Date(fee.payment_date).toLocaleDateString() : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {fee.payment_status === 'unpaid' && (
                        <button
                          onClick={() => handleMarkPaid(fee.id)}
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
    </div>
  );
}
