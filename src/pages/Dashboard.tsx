import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { HelpTooltip } from '../components/HelpTooltip';
import { TrendingUp, TrendingDown, Users, FileText, AlertCircle } from 'lucide-react';

interface DashboardStats {
  monthIncome: number;
  monthExpense: number;
  bankTransactionsCount: number;
  pendingReimbursements: number;
  totalMembersOwed: number;
  totalOwedToMembers: number;
}

interface Activity {
  id: string;
  date: string;
  type: string;
  description: string;
  amount: number;
}

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    monthIncome: 0,
    monthExpense: 0,
    bankTransactionsCount: 0,
    pendingReimbursements: 0,
    totalMembersOwed: 0,
    totalOwedToMembers: 0,
  });
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const { data: ledger } = await supabase
        .from('transactions_ledger')
        .select('*')
        .gte('txn_date', startOfMonth.toISOString().split('T')[0])
        .lte('txn_date', endOfMonth.toISOString().split('T')[0]);

      const monthIncome = ledger?.filter(t => t.amount > 0).reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0;
      const monthExpense = Math.abs(ledger?.filter(t => t.amount < 0).reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0);

      const { count: bankCount } = await supabase
        .from('bank_transactions')
        .select('*', { count: 'exact', head: true })
        .gte('txn_date', startOfMonth.toISOString().split('T')[0])
        .lte('txn_date', endOfMonth.toISOString().split('T')[0]);

      const { count: pendingCount } = await supabase
        .from('reimbursements')
        .select('*', { count: 'exact', head: true })
        .eq('payment_status', 'unpaid');

      const { data: recentActivities } = await supabase
        .from('transactions_ledger')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      setStats({
        monthIncome,
        monthExpense,
        bankTransactionsCount: bankCount || 0,
        pendingReimbursements: pendingCount || 0,
        totalMembersOwed: 0,
        totalOwedToMembers: 0,
      });

      setActivities(
        recentActivities?.map(a => ({
          id: a.id,
          date: a.txn_date,
          type: a.txn_type,
          description: a.description,
          amount: parseFloat(a.amount),
        })) || []
      );

      setLoading(false);
    } catch (error) {
      console.error('Error loading dashboard:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center">
          Dashboard Overview
          <HelpTooltip text="Quick overview of current month finances and recent activity" />
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 flex items-center">
                Monthly Income
                <HelpTooltip text="Total income received this month from all sources" />
              </p>
              <p className="text-3xl font-bold text-green-600 mt-2">
                {stats.monthIncome.toFixed(2)} TL
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 flex items-center">
                Monthly Expenses
                <HelpTooltip text="Total expenses paid this month including cash and reimbursements" />
              </p>
              <p className="text-3xl font-bold text-red-600 mt-2">
                {stats.monthExpense.toFixed(2)} TL
              </p>
            </div>
            <div className="p-3 bg-red-100 rounded-full">
              <TrendingDown className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 flex items-center">
                Bank Transactions
                <HelpTooltip text="Number of bank transactions imported this month" />
              </p>
              <p className="text-3xl font-bold text-blue-600 mt-2">
                {stats.bankTransactionsCount}
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 flex items-center">
                Pending Reimbursements
                <HelpTooltip text="Number of member reimbursements awaiting payment" />
              </p>
              <p className="text-3xl font-bold text-orange-600 mt-2">
                {stats.pendingReimbursements}
              </p>
            </div>
            <div className="p-3 bg-orange-100 rounded-full">
              <AlertCircle className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 flex items-center">
                Members Owe Team
                <HelpTooltip text="Total amount owed to the team by members (fees and merch)" />
              </p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {stats.totalMembersOwed.toFixed(2)} TL
              </p>
            </div>
            <div className="p-3 bg-gray-100 rounded-full">
              <Users className="w-6 h-6 text-gray-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 flex items-center">
                Team Owes Members
                <HelpTooltip text="Total amount team owes to members for reimbursements" />
              </p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {stats.totalOwedToMembers.toFixed(2)} TL
              </p>
            </div>
            <div className="p-3 bg-gray-100 rounded-full">
              <Users className="w-6 h-6 text-gray-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            Recent Activity
            <HelpTooltip text="Latest 20 financial transactions across all categories" />
          </h3>
        </div>
        <div className="p-6">
          {activities.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No transactions yet. Start by importing bank data or recording expenses.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activities.map((activity) => (
                <div key={activity.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{activity.description}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(activity.date).toLocaleDateString()} • {activity.type}
                    </p>
                  </div>
                  <div className={`text-sm font-semibold ${activity.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {activity.amount >= 0 ? '+' : ''}{activity.amount.toFixed(2)} TL
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
