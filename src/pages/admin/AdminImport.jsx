import { useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

const REQUIRED = ['external_id', 'name']
const ALL_COLS = ['external_id', 'name', 'email', 'phone', 'company', 'category', 'role']
const EXAMPLE = `external_id,name,email,phone,company,category
A1,John Smith,john@example.com,0812345678,COV,Expert
A2,Jane Doe,jane@example.com,,AVT,Basic
S1,Tom Lee,tom@example.com,,Thai MFC,Spectator`

function parseCSV(text) {
  const lines = text.trim().split('\n').filter(l => l.trim())
  if (lines.length < 2) throw new Error('File must have a header row and at least one data row.')

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'))

  for (const req of REQUIRED) {
    if (!headers.includes(req)) throw new Error(`Missing required column: "${req}"`)
  }

  return lines.slice(1).map((line, i) => {
    const values = line.split(',').map(v => v.trim())
    const row = {}
    headers.forEach((h, idx) => { row[h] = values[idx] || '' })

    // Derive role from category if not provided
    if (!row.role) {
      row.role = row.category?.toLowerCase() === 'spectator' ? 'spectator' : 'athlete'
    }

    if (!row.external_id) throw new Error(`Row ${i + 2}: missing external_id`)
    if (!row.name) throw new Error(`Row ${i + 2}: missing name`)

    return row
  })
}

export default function AdminImport() {
  const fileRef = useRef(null)
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)
  const [report, setReport] = useState(null)

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setRows(null)
    setReport(null)

    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const parsed = parseCSV(ev.target.result)
        setRows(parsed)
      } catch (err) {
        setError(err.message)
      }
    }
    reader.readAsText(file)
  }

  async function runImport() {
    if (!rows?.length) return
    setImporting(true)
    let success = 0, skipped = 0, errors = []

    for (const row of rows) {
      const payload = {
        external_id: row.external_id,
        name: row.name,
        email: row.email || null,
        phone: row.phone || null,
        company: row.company || null,
        category: row.category || null,
        role: row.role || 'athlete',
        checked_in: false,
        walk_in: false,
      }

      const { error: err } = await supabase
        .from('attendees')
        .upsert(payload, { onConflict: 'external_id', ignoreDuplicates: false })

      if (err) {
        errors.push(`${row.external_id}: ${err.message}`)
      } else {
        success++
      }
    }

    setReport({ success, skipped, errors })
    setImporting(false)

    if (errors.length === 0) {
      toast.success(`${success} attendees imported!`)
    } else {
      toast.error(`${errors.length} errors. ${success} succeeded.`)
    }
  }

  function reset() {
    setRows(null)
    setError('')
    setReport(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="space-y-5">
      <h1 className="font-black text-2xl">Import Attendees</h1>

      {/* Instructions */}
      <div className="card space-y-3">
        <h2 className="font-bold">CSV Format</h2>
        <p className="text-sm text-gray-400">
          Upload a CSV file with these columns. Only <span className="text-white font-semibold">external_id</span> and <span className="text-white font-semibold">name</span> are required.
        </p>
        <div className="bg-gray-50 rounded-xl p-3 overflow-x-auto">
          <pre className="text-xs text-primary font-mono">{EXAMPLE}</pre>
        </div>
        <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
          <li><code className="text-primary">external_id</code> — unique ID (e.g. A1, S1). Pre-registered IDs should NOT start with W (reserved for walk-ins).</li>
          <li><code className="text-primary">category</code> — Basic / Expert / Substitute / Spectator</li>
          <li><code className="text-primary">role</code> — athlete / spectator (auto-derived from category if omitted)</li>
          <li>Existing rows with the same <code className="text-primary">external_id</code> will be updated.</li>
        </ul>
      </div>

      {/* Upload */}
      {!rows && !report && (
        <div className="card space-y-4">
          <h2 className="font-bold">Upload CSV</h2>
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-dark-muted rounded-xl p-8 cursor-pointer hover:border-primary transition-colors">
            <span className="text-4xl mb-2">📂</span>
            <span className="text-sm text-gray-400">Click to choose a CSV file</span>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleFile}
            />
          </label>
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
              <p className="text-red-400 text-sm">❌ {error}</p>
            </div>
          )}
        </div>
      )}

      {/* Preview */}
      {rows && !report && (
        <div className="space-y-4">
          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-bold">Preview — {rows.length} rows</h2>
              <button onClick={reset} className="text-xs text-gray-500 hover:text-white">✕ Clear</button>
            </div>
            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 uppercase">
                    {['ID', 'Name', 'Email', 'Company', 'Category', 'Role'].map(h => (
                      <th key={h} className="text-left px-3 py-2 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-t border-gray-200">
                      <td className="px-3 py-2 font-mono text-primary">{r.external_id}</td>
                      <td className="px-3 py-2 font-medium">{r.name}</td>
                      <td className="px-3 py-2 text-gray-400">{r.email || '—'}</td>
                      <td className="px-3 py-2 text-gray-400">{r.company || '—'}</td>
                      <td className="px-3 py-2">{r.category || '—'}</td>
                      <td className="px-3 py-2">
                        <span className={`badge ${r.role === 'spectator' ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300'}`}>
                          {r.role}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={reset} className="btn-secondary flex-1">Cancel</button>
            <button onClick={runImport} className="btn-primary flex-1" disabled={importing}>
              {importing ? `Importing...` : `⬆️ Import ${rows.length} Attendees`}
            </button>
          </div>
        </div>
      )}

      {/* Report */}
      {report && (
        <div className="space-y-4">
          <div className="card space-y-3">
            <h2 className="font-bold text-lg">Import Complete</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-primary/10 border border-primary/30 rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-primary">{report.success}</p>
                <p className="text-xs text-gray-400">Imported</p>
              </div>
              <div className={`${report.errors.length > 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-gray-50 border-gray-200'} border rounded-xl p-3 text-center`}>
                <p className={`text-2xl font-black ${report.errors.length > 0 ? 'text-red-400' : 'text-gray-500'}`}>{report.errors.length}</p>
                <p className="text-xs text-gray-400">Errors</p>
              </div>
            </div>
            {report.errors.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 space-y-1 max-h-40 overflow-auto">
                {report.errors.map((e, i) => (
                  <p key={i} className="text-xs text-red-400 font-mono">{e}</p>
                ))}
              </div>
            )}
          </div>
          <button onClick={reset} className="btn-primary w-full">Import Another File</button>
        </div>
      )}
    </div>
  )
}
