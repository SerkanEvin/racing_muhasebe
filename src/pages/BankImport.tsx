import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { HelpTooltip } from '../components/HelpTooltip';
import { Upload, CheckCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ParsedRow {
  [key: string]: any;
}

interface ColumnMapping {
  txn_date: string;
  description: string;
  amount: string;
  direction: string;
  counterparty: string;
  reference: string;
}

export function BankImport() {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [columnNames, setColumnNames] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    txn_date: '',
    description: '',
    amount: '',
    direction: '',
    counterparty: '',
    reference: '',
  });
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    const { data } = await supabase
      .from('bank_transactions')
      .select('*')
      .order('txn_date', { ascending: false })
      .limit(50);

    setTransactions(data || []);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setLoading(true);

    try {
      const data = await uploadedFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

      if (jsonData.length > 0) {
        let headers: string[] = [];
        let rows: any[] = [];
        let headerRowIndex = 0;

        // Try to find known header row
        for (let i = 0; i < Math.min(jsonData.length, 25); i++) {
          const row = jsonData[i] as any[];
          if (row && (row.includes('Tarih/Saat') || row.includes('Date'))) {
            headerRowIndex = i;
            headers = row.map((h: any) => String(h || '')); // Ensure strings
            break;
          }
        }

        if (headers.length === 0) {
          headers = (jsonData[0] as any[]).map(h => String(h));
          headerRowIndex = 0;
        }

        const dataRows = jsonData.slice(headerRowIndex + 1);

        rows = dataRows.map((row: any) => {
          const obj: ParsedRow = {};
          headers.forEach((header, index) => {
            if (header) {
              obj[header] = row[index];
            }
          });
          return obj;
        }).filter(r => Object.keys(r).length > 0);

        setColumnNames(headers.filter(h => h && h.trim() !== ''));
        setParsedData(rows);

        // Auto-mapping
        const newMapping = { ...columnMapping };
        if (headers.includes('Tarih/Saat')) newMapping.txn_date = 'Tarih/Saat';
        if (headers.includes('Açıklama')) newMapping.description = 'Açıklama';
        if (headers.includes('İşlem Tutarı*')) newMapping.amount = 'İşlem Tutarı*';
        if (headers.includes('Referans')) newMapping.reference = 'Referans';

        if (newMapping.txn_date) {
          setColumnMapping(newMapping);
        }

        setCurrentStep(2);
      }
    } catch (error) {
      console.error('Error parsing file:', error);
      alert('Error parsing XLS file');
    }

    setLoading(false);
  };

  const handleMappingNext = () => {
    if (!columnMapping.txn_date || !columnMapping.description || !columnMapping.amount) {
      alert('Please map at least Date, Description, and Amount columns');
      return;
    }
    setCurrentStep(3);
  };

  const handleImport = async () => {
    setLoading(true);

    try {
      const transactionsToImport = parsedData.map((row) => {
        let txnDate = row[columnMapping.txn_date];

        // Parse DD/MM/YYYY format
        if (typeof txnDate === 'string' && txnDate.includes('/')) {
          // Take the date part before any time component (e.g. "04/01/2026-15:29:07" -> "04/01/2026")
          const datePart = txnDate.split(/[- ]/)[0];
          const parts = datePart.split('/');
          if (parts.length === 3) {
            // standard DD/MM/YYYY check
            const [day, month, year] = parts;
            if (day.length <= 2 && month.length <= 2 && year.length === 4) {
              txnDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            }
          }
        }

        const description = row[columnMapping.description] || '';
        const amount = parseFloat(String(row[columnMapping.amount] || 0));
        const direction = columnMapping.direction ? String(row[columnMapping.direction] || 'in') : (amount >= 0 ? 'in' : 'out');
        const counterparty = columnMapping.counterparty ? String(row[columnMapping.counterparty] || '') : '';
        const reference = columnMapping.reference ? String(row[columnMapping.reference] || '') : '';

        const hash = `${txnDate}-${description}-${amount}`.replace(/[^a-zA-Z0-9]/g, '');

        return {
          txn_date: txnDate,
          description,
          amount: Math.abs(amount),
          direction: direction.toLowerCase().includes('out') || amount < 0 ? 'out' : 'in',
          counterparty,
          reference,
          import_hash: hash,
          import_filename: file?.name || '',
        };
      });

      const { data: existingHashes } = await supabase
        .from('bank_transactions')
        .select('import_hash')
        .in('import_hash', transactionsToImport.map(t => t.import_hash));

      const existingHashSet = new Set(existingHashes?.map(t => t.import_hash) || []);
      const newTransactions = transactionsToImport.filter(t => !existingHashSet.has(t.import_hash));

      if (newTransactions.length === 0) {
        alert('No new transactions to import (all already exist)');
        setLoading(false);
        return;
      }

      const { error } = await supabase.from('bank_transactions').insert(newTransactions);

      if (error) throw error;

      for (const txn of newTransactions) {
        await supabase.from('transactions_ledger').insert({
          txn_date: txn.txn_date,
          txn_type: 'bank_transaction',
          amount: txn.direction === 'in' ? txn.amount : -txn.amount,
          project: 'General',
          category: 'bank',
          description: txn.description,
          source: 'bank',
          reference_type: 'bank_transaction',
        });
      }

      alert(`Successfully imported ${newTransactions.length} transactions`);
      setCurrentStep(4);
      loadTransactions();
    } catch (error) {
      console.error('Error importing transactions:', error);
      alert('Error importing transactions');
    }

    setLoading(false);
  };

  const resetImport = () => {
    setCurrentStep(1);
    setFile(null);
    setParsedData([]);
    setColumnNames([]);
    setColumnMapping({
      txn_date: '',
      description: '',
      amount: '',
      direction: '',
      counterparty: '',
      reference: '',
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center">
          Bank Import
          <HelpTooltip text="Import bank transactions from XLS files with manual column mapping" />
        </h2>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          {[1, 2, 3, 4].map((step) => (
            <div key={step} className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${currentStep >= step ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                  }`}
              >
                {currentStep > step ? <CheckCircle className="w-6 h-6" /> : step}
              </div>
              {step < 4 && (
                <div
                  className={`w-24 h-1 ${currentStep > step ? 'bg-blue-600' : 'bg-gray-200'}`}
                />
              )}
            </div>
          ))}
        </div>

        {currentStep === 1 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Step 1: Upload XLS File</h3>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
              <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">Upload your bank transactions XLS file</p>
              <input
                type="file"
                accept=".xls,.xlsx"
                onChange={handleFileUpload}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Step 2: Map Columns</h3>
              <button
                onClick={resetImport}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Start Over
              </button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
              Map your XLS columns to the required fields. At minimum, map Date, Description, and Amount.
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                    Transaction Date Column (Required)
                    <HelpTooltip text="Column containing the transaction date" />
                  </label>
                  <select
                    value={columnMapping.txn_date}
                    onChange={(e) => setColumnMapping({ ...columnMapping, txn_date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Select column</option>
                    {columnNames.map((col) => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                    Description Column (Required)
                    <HelpTooltip text="Column containing transaction description" />
                  </label>
                  <select
                    value={columnMapping.description}
                    onChange={(e) => setColumnMapping({ ...columnMapping, description: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Select column</option>
                    {columnNames.map((col) => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                    Amount Column (Required)
                    <HelpTooltip text="Column containing transaction amount" />
                  </label>
                  <select
                    value={columnMapping.amount}
                    onChange={(e) => setColumnMapping({ ...columnMapping, amount: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Select column</option>
                    {columnNames.map((col) => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                    Direction Column (Optional)
                    <HelpTooltip text="Column indicating in/out (will auto-detect from amount if not provided)" />
                  </label>
                  <select
                    value={columnMapping.direction}
                    onChange={(e) => setColumnMapping({ ...columnMapping, direction: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Select column (optional)</option>
                    {columnNames.map((col) => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                    Counterparty Column (Optional)
                    <HelpTooltip text="Column with other party name" />
                  </label>
                  <select
                    value={columnMapping.counterparty}
                    onChange={(e) => setColumnMapping({ ...columnMapping, counterparty: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Select column (optional)</option>
                    {columnNames.map((col) => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                    Reference Column (Optional)
                    <HelpTooltip text="Column with reference number" />
                  </label>
                  <select
                    value={columnMapping.reference}
                    onChange={(e) => setColumnMapping({ ...columnMapping, reference: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Select column (optional)</option>
                    {columnNames.map((col) => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                onClick={handleMappingNext}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Next: Preview Data
              </button>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Step 3: Preview & Import</h3>
              <button
                onClick={() => setCurrentStep(2)}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Back to Mapping
              </button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
              Preview of first 20 rows. Review and click Import to add to database.
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Description</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Amount</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Direction</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {parsedData.slice(0, 20).map((row, idx) => {
                    const amount = parseFloat(String(row[columnMapping.amount] || 0));
                    const direction = columnMapping.direction
                      ? String(row[columnMapping.direction] || 'in')
                      : (amount >= 0 ? 'in' : 'out');

                    return (
                      <tr key={idx}>
                        <td className="px-4 py-2">{String(row[columnMapping.txn_date])}</td>
                        <td className="px-4 py-2">{String(row[columnMapping.description] || '')}</td>
                        <td className="px-4 py-2 font-semibold">{Math.abs(amount).toFixed(2)} TL</td>
                        <td className="px-4 py-2">
                          <span className={`px-2 py-1 text-xs rounded-full ${direction.toLowerCase().includes('out') || amount < 0
                            ? 'bg-red-100 text-red-800'
                            : 'bg-green-100 text-green-800'
                            }`}>
                            {direction.toLowerCase().includes('out') || amount < 0 ? 'Out' : 'In'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-4">
              <button
                onClick={handleImport}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Importing...' : `Import ${parsedData.length} Transactions`}
              </button>
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-4 text-center py-8">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900">Import Complete!</h3>
            <p className="text-gray-600">Your bank transactions have been successfully imported.</p>
            <button
              onClick={resetImport}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Import Another File
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            Recent Imports
            <HelpTooltip text="Latest 50 imported bank transactions" />
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Direction</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">File</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    No transactions imported yet. Upload an XLS file to begin.
                  </td>
                </tr>
              ) : (
                transactions.map((txn) => (
                  <tr key={txn.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{new Date(txn.txn_date).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-sm max-w-xs truncate">{txn.description}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                      {parseFloat(String(txn.amount)).toFixed(2)} TL
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${txn.direction === 'out'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-green-100 text-green-800'
                        }`}>
                        {txn.direction === 'out' ? 'Out' : 'In'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{txn.import_filename}</td>
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
