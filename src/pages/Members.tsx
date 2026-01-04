import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { HelpTooltip } from '../components/HelpTooltip';
import { Plus, Upload, UserX, Search } from 'lucide-react';

interface Member {
  id: string;
  full_name: string;
  team: string;
  join_date: string;
  leave_date: string | null;
  notes: string;
}

export function Members() {
  const [members, setMembers] = useState<Member[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  const [formData, setFormData] = useState({
    full_name: '',
    team: '',
    join_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const [importData, setImportData] = useState<any[]>([]);
  const [importPreview, setImportPreview] = useState(false);

  useEffect(() => {
    loadMembers();
  }, []);

  useEffect(() => {
    filterMembers();
  }, [members, searchTerm, filterStatus]);

  const loadMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .order('join_date', { ascending: false });

      if (error) throw error;
      setMembers(data || []);
      setLoading(false);
    } catch (error) {
      console.error('Error loading members:', error);
      setLoading(false);
    }
  };

  const filterMembers = () => {
    let filtered = members;

    if (searchTerm) {
      filtered = filtered.filter(m =>
        m.full_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterStatus === 'active') {
      filtered = filtered.filter(m => !m.leave_date);
    } else if (filterStatus === 'inactive') {
      filtered = filtered.filter(m => m.leave_date);
    }

    setFilteredMembers(filtered);
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('members').insert([formData]);
      if (error) throw error;

      setShowAddModal(false);
      setFormData({ full_name: '', team: '', join_date: new Date().toISOString().split('T')[0], notes: '' });
      loadMembers();
    } catch (error) {
      console.error('Error adding member:', error);
      alert('Error adding member');
    }
  };

  const handleMarkLeft = async (memberId: string) => {
    if (!confirm('Mark this member as left?')) return;

    try {
      const { error } = await supabase
        .from('members')
        .update({ leave_date: new Date().toISOString().split('T')[0] })
        .eq('id', memberId);

      if (error) throw error;
      loadMembers();
    } catch (error) {
      console.error('Error updating member:', error);
      alert('Error updating member');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const membersArray = Array.isArray(json) ? json : [json];
        const mappedMembers = membersArray.map((m: any) => ({
          full_name: m.full_name || m['İsim Soyisim'],
          team: m.team || m['Ekip'] || '',
          join_date: m.join_date || new Date().toISOString().split('T')[0],
          notes: m.notes || ''
        }));
        setImportData(mappedMembers);
        setImportPreview(true);
      } catch (error) {
        alert('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    try {
      const existingNames = new Set(members.map(m => m.full_name.toLowerCase()));
      const newMembers = importData.filter(m =>
        !existingNames.has(m.full_name?.toLowerCase())
      );

      if (newMembers.length === 0) {
        alert('No new members to import (all already exist)');
        return;
      }

      const { error } = await supabase.from('members').insert(
        newMembers.map(m => ({
          full_name: m.full_name,
          team: m.team,
          join_date: m.join_date || new Date().toISOString().split('T')[0],
          notes: m.notes || '',
        }))
      );

      if (error) throw error;

      alert(`Imported ${newMembers.length} new members`);
      setShowImportModal(false);
      setImportData([]);
      setImportPreview(false);
      loadMembers();
    } catch (error) {
      console.error('Error importing members:', error);
      alert('Error importing members');
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading members...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center">
          Team Members
          <HelpTooltip text="Manage team members and import from JSON files" />
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <Upload className="w-4 h-4 mr-2" />
            Import JSON
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Member
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search members..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          >
            <option value="all">All Members</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                  <HelpTooltip text="Member's full name" />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Team
                  <HelpTooltip text="Member's team" />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Join Date
                  <HelpTooltip text="Date the member joined the team" />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                  <HelpTooltip text="Active or inactive based on leave date" />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Notes
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    No members found. Add members manually or import from JSON.
                  </td>
                </tr>
              ) : (
                filteredMembers.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{member.full_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{member.team || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {new Date(member.join_date).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {member.leave_date ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                          Inactive
                        </span>
                      ) : (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-500 max-w-xs truncate">{member.notes || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {!member.leave_date && (
                        <button
                          onClick={() => handleMarkLeft(member.id)}
                          className="text-red-600 hover:text-red-900 flex items-center ml-auto"
                        >
                          <UserX className="w-4 h-4 mr-1" />
                          Mark Left
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
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              Add New Member
              <HelpTooltip text="Add a new team member manually" />
            </h3>
            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                  Full Name
                  <HelpTooltip text="Member's complete name" />
                </label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                  Team
                  <HelpTooltip text="Member's team" />
                </label>
                <input
                  type="text"
                  value={formData.team}
                  onChange={(e) => setFormData({ ...formData, team: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                  Join Date
                  <HelpTooltip text="Date the member joined the team" />
                </label>
                <input
                  type="date"
                  required
                  value={formData.join_date}
                  onChange={(e) => setFormData({ ...formData, join_date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                  Notes
                  <HelpTooltip text="Optional notes about the member" />
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  rows={3}
                />
              </div>
              <div className="flex gap-3 justify-end pt-4">
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
                  Add Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              Import Members from JSON
              <HelpTooltip text="Upload a JSON file with member data. Duplicates are automatically skipped." />
            </h3>

            {!importPreview ? (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-sm text-gray-600 mb-4">
                    Upload a JSON file with member data
                  </p>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                </div>

                <div className="bg-gray-50 rounded-lg p-4 text-sm">
                  <p className="font-medium text-gray-900 mb-2">Expected JSON format:</p>
                  <pre className="text-xs text-gray-600 overflow-x-auto">
                    {`[
  {
    "full_name": "John Doe",
    "join_date": "2024-01-15",
    "notes": "Optional notes"
  }
]`}
                  </pre>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => setShowImportModal(false)}
                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                  Found {importData.length} members in file. Duplicates will be automatically skipped.
                </div>

                <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
                  <table className="w-full">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Name</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Team</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Join Date</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {importData.map((m, idx) => {
                        const isDuplicate = members.some(existing =>
                          existing.full_name.toLowerCase() === m.full_name?.toLowerCase()
                        );
                        return (
                          <tr key={idx} className={isDuplicate ? 'bg-gray-50' : ''}>
                            <td className="px-4 py-2 text-sm">{m.full_name}</td>
                            <td className="px-4 py-2 text-sm">{m.team}</td>
                            <td className="px-4 py-2 text-sm">{m.join_date || 'Today'}</td>
                            <td className="px-4 py-2 text-sm">
                              {isDuplicate ? (
                                <span className="text-xs text-red-600">Duplicate</span>
                              ) : (
                                <span className="text-xs text-green-600">New</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => {
                      setImportPreview(false);
                      setImportData([]);
                      setShowImportModal(false);
                    }}
                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleImport}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Import Members
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
