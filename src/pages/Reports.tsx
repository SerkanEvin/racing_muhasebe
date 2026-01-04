import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { HelpTooltip } from '../components/HelpTooltip';
import { Download, BarChart3, Users, DollarSign, Package } from 'lucide-react';

export function Reports() {
  const [activeTab, setActiveTab] = useState<'pl' | 'balances' | 'cashflow' | 'inventory'>('pl');
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });

  const [plData, setPlData] = useState<any[]>([]);
  const [memberBalances, setMemberBalances] = useState<any[]>([]);
  const [cashflowData, setCashflowData] = useState<any[]>([]);
  const [inventoryData, setInventoryData] = useState<any[]>([]);

  useEffect(() => {
    loadReportData();
  }, [activeTab, dateRange]);

  const loadReportData = async () => {
    setLoading(true);

    if (activeTab === 'pl') {
      await loadPLReport();
    } else if (activeTab === 'balances') {
      await loadMemberBalances();
    } else if (activeTab === 'cashflow') {
      await loadCashflow();
    } else if (activeTab === 'inventory') {
      await loadInventory();
    }

    setLoading(false);
  };

  const loadPLReport = async () => {
    const { data } = await supabase
      .from('transactions_ledger')
      .select('*')
      .gte('txn_date', dateRange.start)
      .lte('txn_date', dateRange.end);

    const summary: any = {};

    data?.forEach(txn => {
      const key = `${txn.category}-${txn.project}`;
      if (!summary[key]) {
        summary[key] = {
          category: txn.category,
          project: txn.project,
          income: 0,
          expense: 0,
        };
      }

      const amount = parseFloat(txn.amount);
      if (amount > 0) {
        summary[key].income += amount;
      } else {
        summary[key].expense += Math.abs(amount);
      }
    });

    setPlData(Object.values(summary));
  };

  const loadMemberBalances = async () => {
    const { data: members } = await supabase.from('members').select('*');
    const { data: fees } = await supabase.from('membership_fees').select('*');
    const { data: sales } = await supabase.from('sales_orders').select('*');
    const { data: reimbursements } = await supabase.from('reimbursements').select('*');

    const balances = members?.map(member => {
      const memberFees = fees?.filter(f => f.member_id === member.id) || [];
      const memberSales = sales?.filter(s => s.member_id === member.id) || [];
      const memberReimb = reimbursements?.filter(r => r.member_id === member.id) || [];

      const feesCharged = memberFees
        .filter(f => f.payment_status === 'unpaid')
        .reduce((sum, f) => sum + parseFloat(String(f.amount)), 0);

      const salesUnpaid = memberSales
        .filter(s => s.payment_status === 'unpaid')
        .reduce((sum, s) => sum + parseFloat(String(s.total_amount)), 0);

      const reimbOwed = memberReimb
        .filter(r => r.payment_status === 'unpaid')
        .reduce((sum, r) => sum + parseFloat(String(r.amount)), 0);

      const netBalance = feesCharged + salesUnpaid - reimbOwed;

      return {
        member_name: member.full_name,
        fees_owed: feesCharged,
        sales_owed: salesUnpaid,
        reimb_owed: reimbOwed,
        net_balance: netBalance,
      };
    }) || [];

    setMemberBalances(balances);
  };

  const loadCashflow = async () => {
    const { data } = await supabase
      .from('transactions_ledger')
      .select('*')
      .gte('txn_date', dateRange.start)
      .lte('txn_date', dateRange.end)
      .order('txn_date');

    const monthlyData: any = {};

    data?.forEach(txn => {
      const month = txn.txn_date.substring(0, 7);
      if (!monthlyData[month]) {
        monthlyData[month] = { month, inflow: 0, outflow: 0 };
      }

      const amount = parseFloat(txn.amount);
      if (amount > 0) {
        monthlyData[month].inflow += amount;
      } else {
        monthlyData[month].outflow += Math.abs(amount);
      }
    });

    setCashflowData(Object.values(monthlyData));
  };

  const loadInventory = async () => {
    const { data: products } = await supabase.from('products').select('*');
    const { data: items } = await supabase.from('sales_order_items').select('*');

    const inventory = products?.map(product => {
      const productSales = items?.filter(i => i.product_id === product.id) || [];
      const totalSold = productSales.reduce((sum, i) => sum + i.quantity, 0);
      const totalRevenue = productSales.reduce((sum, i) => sum + parseFloat(String(i.line_total)), 0);

      return {
        product_name: product.name,
        stock: product.stock_quantity,
        unit_price: product.unit_price,
        total_sold: totalSold,
        total_revenue: totalRevenue,
      };
    }) || [];

    setInventoryData(inventory);
  };

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(h => row[h]).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center">
          Financial Reports
          <HelpTooltip text="View and export financial reports with various breakdowns" />
        </h2>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
            <div className="flex gap-2">
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none"
              />
              <span className="self-center text-gray-500">to</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('pl')}
              className={`px-6 py-3 text-sm font-medium ${
                activeTab === 'pl'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <BarChart3 className="w-4 h-4 inline mr-2" />
              P&L Report
            </button>
            <button
              onClick={() => setActiveTab('balances')}
              className={`px-6 py-3 text-sm font-medium ${
                activeTab === 'balances'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Users className="w-4 h-4 inline mr-2" />
              Member Balances
            </button>
            <button
              onClick={() => setActiveTab('cashflow')}
              className={`px-6 py-3 text-sm font-medium ${
                activeTab === 'cashflow'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <DollarSign className="w-4 h-4 inline mr-2" />
              Cashflow
            </button>
            <button
              onClick={() => setActiveTab('inventory')}
              className={`px-6 py-3 text-sm font-medium ${
                activeTab === 'inventory'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Package className="w-4 h-4 inline mr-2" />
              Inventory
            </button>
          </nav>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">Loading report...</div>
          ) : (
            <>
              {activeTab === 'pl' && (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Income vs Expense by Category & Project</h3>
                    <button
                      onClick={() => exportToCSV(plData, 'pl-report')}
                      className="flex items-center px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Export CSV
                    </button>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left">Category</th>
                        <th className="px-4 py-2 text-left">Project</th>
                        <th className="px-4 py-2 text-right">Income (TL)</th>
                        <th className="px-4 py-2 text-right">Expense (TL)</th>
                        <th className="px-4 py-2 text-right">Net (TL)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {plData.map((row, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-2">{row.category}</td>
                          <td className="px-4 py-2">{row.project}</td>
                          <td className="px-4 py-2 text-right text-green-600">{row.income.toFixed(2)}</td>
                          <td className="px-4 py-2 text-right text-red-600">{row.expense.toFixed(2)}</td>
                          <td className="px-4 py-2 text-right font-semibold">{(row.income - row.expense).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'balances' && (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Member Balance Summary</h3>
                    <button
                      onClick={() => exportToCSV(memberBalances, 'member-balances')}
                      className="flex items-center px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Export CSV
                    </button>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left">Member</th>
                        <th className="px-4 py-2 text-right">Fees Owed (TL)</th>
                        <th className="px-4 py-2 text-right">Sales Owed (TL)</th>
                        <th className="px-4 py-2 text-right">Reimb. Owed to Member (TL)</th>
                        <th className="px-4 py-2 text-right">Net Balance (TL)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {memberBalances.map((row, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-2">{row.member_name}</td>
                          <td className="px-4 py-2 text-right">{row.fees_owed.toFixed(2)}</td>
                          <td className="px-4 py-2 text-right">{row.sales_owed.toFixed(2)}</td>
                          <td className="px-4 py-2 text-right text-red-600">{row.reimb_owed.toFixed(2)}</td>
                          <td className={`px-4 py-2 text-right font-semibold ${row.net_balance > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {row.net_balance.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'cashflow' && (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Monthly Cashflow</h3>
                    <button
                      onClick={() => exportToCSV(cashflowData, 'cashflow')}
                      className="flex items-center px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Export CSV
                    </button>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left">Month</th>
                        <th className="px-4 py-2 text-right">Inflow (TL)</th>
                        <th className="px-4 py-2 text-right">Outflow (TL)</th>
                        <th className="px-4 py-2 text-right">Net (TL)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {cashflowData.map((row: any, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-2">{row.month}</td>
                          <td className="px-4 py-2 text-right text-green-600">{row.inflow.toFixed(2)}</td>
                          <td className="px-4 py-2 text-right text-red-600">{row.outflow.toFixed(2)}</td>
                          <td className="px-4 py-2 text-right font-semibold">{(row.inflow - row.outflow).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'inventory' && (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Inventory & Sales Summary</h3>
                    <button
                      onClick={() => exportToCSV(inventoryData, 'inventory')}
                      className="flex items-center px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Export CSV
                    </button>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left">Product</th>
                        <th className="px-4 py-2 text-right">Current Stock</th>
                        <th className="px-4 py-2 text-right">Unit Price (TL)</th>
                        <th className="px-4 py-2 text-right">Total Sold</th>
                        <th className="px-4 py-2 text-right">Total Revenue (TL)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {inventoryData.map((row: any, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-2">{row.product_name}</td>
                          <td className="px-4 py-2 text-right">{row.stock}</td>
                          <td className="px-4 py-2 text-right">{parseFloat(String(row.unit_price)).toFixed(2)}</td>
                          <td className="px-4 py-2 text-right">{row.total_sold}</td>
                          <td className="px-4 py-2 text-right font-semibold">{row.total_revenue.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
