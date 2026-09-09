import { useState, useEffect, useMemo, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { subscribeReliefRequests } from '../firebase/requests'
import { subscribeInventoryItems } from '../firebase/inventory'
import { subscribeDonations } from '../firebase/donations'
import { formatRequestDate, getStatusLabel, getStatusClass } from '../utils/requestHelpers'
import { formatInventoryDate, getCategoryLabel, isLowStock, countLowStock } from '../utils/inventoryHelpers'
import nagaLogo from '../assets/naga-logo.jpg'
import '../styles/GenerateReportModal.css'

export default function GenerateReportModal({
  isOpen,
  onClose,
  initialRequests,
  initialItems,
  initialDonations,
  user,
  profile,
}) {
  const [reportType, setReportType] = useState('summary') // 'summary' | 'requests' | 'inventory' | 'donations'
  const [timeframe, setTimeframe] = useState('all') // 'all' | '24h' | '7d' | '30d'
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'pending' | 'in-progress' | 'completed'

  const [fetchedRequests, setFetchedRequests] = useState([])
  const [fetchedItems, setFetchedItems] = useState([])
  const [fetchedDonations, setFetchedDonations] = useState([])
  const [reportTime] = useState(() => Date.now())

  const requests = initialRequests || fetchedRequests
  const items = initialItems || fetchedItems
  const donations = initialDonations || fetchedDonations

  // Sync / Subscribe to real-time data when modal opens
  useEffect(() => {
    if (!isOpen) return

    let unsubReq = () => {}
    let unsubInv = () => {}
    let unsubDon = () => {}

    if (!initialRequests) {
      unsubReq = subscribeReliefRequests(
        (data) => {
          setFetchedRequests(data)
        },
        () => {},
        { uid: user?.uid, role: profile?.role }
      )
    }

    if (!initialItems) {
      unsubInv = subscribeInventoryItems(
        (data) => setFetchedItems(data),
        () => {}
      )
    }

    if (!initialDonations) {
      unsubDon = subscribeDonations(
        (data) => setFetchedDonations(data),
        () => {}
      )
    }

    return () => {
      unsubReq()
      unsubInv()
      unsubDon()
    }
  }, [isOpen, initialRequests, initialItems, initialDonations, user?.uid, profile?.role])

  // Filter items by timeframe
  const filterByTime = useCallback(
    (list) => {
      if (timeframe === 'all') return list
      const msMap = {
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
      }
      const cutoff = reportTime - (msMap[timeframe] || 0)

      return list.filter((item) => {
        const d = item.createdAt instanceof Date ? item.createdAt.getTime() : null
        return d ? d >= cutoff : true
      })
    },
    [timeframe, reportTime]
  )

  const filteredRequests = useMemo(() => {
    let list = filterByTime(requests)
    if (statusFilter !== 'all') {
      list = list.filter((r) => r.status === statusFilter)
    }
    return list
  }, [requests, filterByTime, statusFilter])

  const filteredItems = useMemo(() => {
    return filterByTime(items)
  }, [items, filterByTime])

  const filteredDonations = useMemo(() => {
    return filterByTime(donations)
  }, [donations, filterByTime])

  // Metrics
  const reqTotal = filteredRequests.length
  const reqPending = filteredRequests.filter((r) => r.status === 'pending').length
  const reqInProgress = filteredRequests.filter((r) => r.status === 'in-progress').length
  const reqCompleted = filteredRequests.filter((r) => r.status === 'completed').length
  const totalBeneficiaries = filteredRequests.reduce((s, r) => s + (Number(r.familyMembers) || 0), 0)

  const invTotalItems = filteredItems.length
  const invTotalQty = filteredItems.reduce((s, i) => s + (Number(i.quantity) || 0), 0)
  const invLowStock = countLowStock(filteredItems)

  const donTotal = filteredDonations.length
  const donTotalQty = filteredDonations.reduce((s, d) => s + (Number(d.quantity) || 0), 0)
  const donAgencies = new Set(filteredDonations.map((d) => d.agency?.trim()).filter(Boolean)).size

  const operatorName =
    profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'ReliefTrack Officer'
  const operatorRole = profile?.role || 'Operations Staff'
  const reportDateStr = new Date().toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  if (!isOpen) return null

  // CSV Generator
  const downloadCSV = () => {
    let csvRows = []

    const escapeCSV = (val) => {
      if (val === null || val === undefined) return '""'
      const str = String(val).replace(/"/g, '""')
      return `"${str}"`
    }

    if (reportType === 'requests') {
      csvRows.push([
        'Request ID',
        'Requester Name',
        'Location',
        'Family Members',
        'Evacuation Center',
        'Status',
        'Date Created',
      ])
      filteredRequests.forEach((r) => {
        csvRows.push([
          r.requestId || '—',
          r.requesterName || '—',
          r.location || '—',
          r.familyMembers ?? 0,
          r.hasEvacuationCenter ? 'Yes' : 'No',
          getStatusLabel(r.status),
          formatRequestDate(r.createdAt),
        ])
      })
    } else if (reportType === 'inventory') {
      csvRows.push([
        'Item ID',
        'Item Name',
        'Category',
        'Quantity',
        'Unit',
        'Storage Location',
        'Stock Status',
        'Last Updated',
      ])
      filteredItems.forEach((i) => {
        csvRows.push([
          i.itemId || '—',
          i.name || '—',
          getCategoryLabel(i.category),
          i.quantity ?? 0,
          i.unit || '—',
          i.storageLocation || '—',
          isLowStock(i.quantity) ? 'LOW STOCK' : 'Normal',
          formatInventoryDate(i.updatedAt || i.createdAt),
        ])
      })
    } else if (reportType === 'donations') {
      csvRows.push([
        'Donor / Agency',
        'Type',
        'Items Description',
        'Quantity',
        'Unit',
        'Received Date',
        'Notes',
      ])
      filteredDonations.forEach((d) => {
        csvRows.push([
          d.agency || '—',
          d.type || '—',
          d.items || '—',
          d.quantity ?? 0,
          d.unit || '—',
          formatRequestDate(d.createdAt),
          d.notes || '—',
        ])
      })
    } else {
      // Summary
      csvRows.push(['RELIEF OPERATIONS EXECUTIVE SUMMARY REPORT'])
      csvRows.push(['Generated On', reportDateStr])
      csvRows.push(['Generated By', `${operatorName} (${operatorRole})`])
      csvRows.push(['Timeframe Scope', timeframe.toUpperCase()])
      csvRows.push([])
      csvRows.push(['--- RELIEF REQUESTS METRICS ---'])
      csvRows.push(['Total Requests', reqTotal])
      csvRows.push(['Pending Requests', reqPending])
      csvRows.push(['In Progress', reqInProgress])
      csvRows.push(['Completed Operations', reqCompleted])
      csvRows.push(['Total Affected Beneficiaries', totalBeneficiaries])
      csvRows.push([])
      csvRows.push(['--- INVENTORY STATUS ---'])
      csvRows.push(['Total Item Catalog', invTotalItems])
      csvRows.push(['Total Units in Stock', invTotalQty])
      csvRows.push(['Low Stock Items (<10 units)', invLowStock])
      csvRows.push([])
      csvRows.push(['--- DONATION CONTRIBUTIONS ---'])
      csvRows.push(['Total Donations Received', donTotal])
      csvRows.push(['Total Donated Quantity', donTotalQty])
      csvRows.push(['Partner Agencies / Donors', donAgencies])
    }

    const csvContent = csvRows
      .map((row) => row.map(escapeCSV).join(','))
      .join('\r\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute(
      'download',
      `ReliefTrack_${reportType}_Report_${new Date().toISOString().slice(0, 10)}.csv`
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Excel (.xlsx) Generator
  const downloadExcel = () => {
    const wb = XLSX.utils.book_new()
    const dateStr = new Date().toISOString().slice(0, 10)

    if (reportType === 'requests') {
      const rows = [
        ['Request ID', 'Requester Name', 'Location', 'Family Members', 'Evacuation Center', 'Status', 'Date Created'],
        ...filteredRequests.map((r) => [
          r.requestId || '—',
          r.requesterName || '—',
          r.location || '—',
          r.familyMembers ?? 0,
          r.hasEvacuationCenter ? 'Yes' : 'No',
          getStatusLabel(r.status),
          formatRequestDate(r.createdAt),
        ]),
      ]
      const ws = XLSX.utils.aoa_to_sheet(rows)
      XLSX.utils.book_append_sheet(wb, ws, 'Relief Requests')
      XLSX.writeFile(wb, `ReliefTrack_Requests_${dateStr}.xlsx`)
    } else if (reportType === 'inventory') {
      const rows = [
        ['Item ID', 'Item Name', 'Category', 'Quantity', 'Unit', 'Storage Location', 'Stock Status', 'Last Updated'],
        ...filteredItems.map((i) => [
          i.itemId || '—',
          i.name || '—',
          getCategoryLabel(i.category),
          i.quantity ?? 0,
          i.unit || '—',
          i.storageLocation || '—',
          isLowStock(i.quantity) ? 'LOW STOCK' : 'Normal',
          formatInventoryDate(i.updatedAt || i.createdAt),
        ]),
      ]
      const ws = XLSX.utils.aoa_to_sheet(rows)
      XLSX.utils.book_append_sheet(wb, ws, 'Inventory Supplies')
      XLSX.writeFile(wb, `ReliefTrack_Inventory_${dateStr}.xlsx`)
    } else if (reportType === 'donations') {
      const rows = [
        ['Donor / Agency', 'Type', 'Items Description', 'Quantity', 'Unit', 'Received Date', 'Notes'],
        ...filteredDonations.map((d) => [
          d.agency || '—',
          d.type || '—',
          d.items || '—',
          d.quantity ?? 0,
          d.unit || '—',
          formatRequestDate(d.createdAt),
          d.notes || '—',
        ]),
      ]
      const ws = XLSX.utils.aoa_to_sheet(rows)
      XLSX.utils.book_append_sheet(wb, ws, 'Donations')
      XLSX.writeFile(wb, `ReliefTrack_Donations_${dateStr}.xlsx`)
    } else {
      // Summary - multi-sheet workbook
      const summaryRows = [
        ['RELIEF OPERATIONS EXECUTIVE SUMMARY REPORT'],
        ['Generated On', reportDateStr],
        ['Generated By', `${operatorName} (${operatorRole})`],
        ['Timeframe Scope', timeframe.toUpperCase()],
        [],
        ['--- RELIEF REQUESTS METRICS ---'],
        ['Total Requests', reqTotal],
        ['Pending Requests', reqPending],
        ['In Progress', reqInProgress],
        ['Completed Operations', reqCompleted],
        ['Total Affected Beneficiaries', totalBeneficiaries],
        [],
        ['--- INVENTORY STATUS ---'],
        ['Total Item Catalog', invTotalItems],
        ['Total Units in Stock', invTotalQty],
        ['Low Stock Items (<10 units)', invLowStock],
        [],
        ['--- DONATION CONTRIBUTIONS ---'],
        ['Total Donations Received', donTotal],
        ['Total Donated Quantity', donTotalQty],
        ['Partner Agencies / Donors', donAgencies],
      ]
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows)
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Executive Summary')

      const reqRows = [
        ['Request ID', 'Requester Name', 'Location', 'Family Members', 'Evacuation Center', 'Status', 'Date Created'],
        ...filteredRequests.map((r) => [
          r.requestId || '—',
          r.requesterName || '—',
          r.location || '—',
          r.familyMembers ?? 0,
          r.hasEvacuationCenter ? 'Yes' : 'No',
          getStatusLabel(r.status),
          formatRequestDate(r.createdAt),
        ]),
      ]
      const wsReq = XLSX.utils.aoa_to_sheet(reqRows)
      XLSX.utils.book_append_sheet(wb, wsReq, 'Relief Requests')

      const invRows = [
        ['Item ID', 'Item Name', 'Category', 'Quantity', 'Unit', 'Storage Location', 'Stock Status', 'Last Updated'],
        ...filteredItems.map((i) => [
          i.itemId || '—',
          i.name || '—',
          getCategoryLabel(i.category),
          i.quantity ?? 0,
          i.unit || '—',
          i.storageLocation || '—',
          isLowStock(i.quantity) ? 'LOW STOCK' : 'Normal',
          formatInventoryDate(i.updatedAt || i.createdAt),
        ]),
      ]
      const wsInv = XLSX.utils.aoa_to_sheet(invRows)
      XLSX.utils.book_append_sheet(wb, wsInv, 'Inventory')

      const donRows = [
        ['Donor / Agency', 'Type', 'Items Description', 'Quantity', 'Unit', 'Received Date', 'Notes'],
        ...filteredDonations.map((d) => [
          d.agency || '—',
          d.type || '—',
          d.items || '—',
          d.quantity ?? 0,
          d.unit || '—',
          formatRequestDate(d.createdAt),
          d.notes || '—',
        ]),
      ]
      const wsDon = XLSX.utils.aoa_to_sheet(donRows)
      XLSX.utils.book_append_sheet(wb, wsDon, 'Donations')

      XLSX.writeFile(wb, `ReliefTrack_Operations_Report_${dateStr}.xlsx`)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="grm-overlay" onClick={onClose}>
      <div className="grm-modal" onClick={(e) => e.stopPropagation()}>
        {/* Modal Topbar */}
        <div className="grm-header">
          <div className="grm-title-group">
            <h3>📄 Generate Operations Report</h3>
            <p>Export official relief analytics, supply manifests, and request logs.</p>
          </div>
          <button
            type="button"
            className="grm-close-btn"
            onClick={onClose}
            aria-label="Close report modal"
          >
            ✕
          </button>
        </div>

        {/* Modal Controls Toolbar (Hidden in Print) */}
        <div className="grm-toolbar">
          <div className="grm-tabs">
            <button
              type="button"
              className={`grm-tab ${reportType === 'summary' ? 'active' : ''}`}
              onClick={() => setReportType('summary')}
            >
              📊 Executive Summary
            </button>
            <button
              type="button"
              className={`grm-tab ${reportType === 'requests' ? 'active' : ''}`}
              onClick={() => setReportType('requests')}
            >
              📋 Relief Requests ({reqTotal})
            </button>
            <button
              type="button"
              className={`grm-tab ${reportType === 'inventory' ? 'active' : ''}`}
              onClick={() => setReportType('inventory')}
            >
              📦 Inventory ({invTotalItems})
            </button>
            <button
              type="button"
              className={`grm-tab ${reportType === 'donations' ? 'active' : ''}`}
              onClick={() => setReportType('donations')}
            >
              🎁 Donations ({donTotal})
            </button>
          </div>

          <div className="grm-filters">
            <select
              className="grm-select"
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              aria-label="Filter timeframe"
            >
              <option value="all">All Time</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>

            {reportType === 'requests' && (
              <select
                className="grm-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter status"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            )}
          </div>

          <div className="grm-actions">
            <button
              type="button"
              className="grm-btn grm-btn-secondary"
              onClick={downloadCSV}
              title="Download structured CSV file"
            >
              📥 Export CSV
            </button>
            <button
              type="button"
              className="grm-btn grm-btn-excel"
              onClick={downloadExcel}
              title="Download Microsoft Excel workbook (.xlsx)"
            >
              📊 Export Excel
            </button>
            <button
              type="button"
              className="grm-btn grm-btn-primary"
              onClick={handlePrint}
              title="Print document or save as PDF"
            >
              🖨️ Print / Save as PDF
            </button>
          </div>
        </div>

        {/* Modal Scrollable Report Document Body */}
        <div className="grm-body">
          <div className="grm-sheet">
            {/* Naga City & CDRRMO Official Letterhead */}
            <div className="grm-sheet-header">
              <div className="grm-sheet-brand">
                <img src={nagaLogo} alt="Naga City Logo" className="grm-sheet-logo" />
                <div className="grm-sheet-title-text">
                  <h4>Republic of the Philippines • City Government of Naga</h4>
                  <h2>
                    {reportType === 'summary' && 'Relief Operations Consolidated Report'}
                    {reportType === 'requests' && 'Relief Requests & Aid Dispatch Report'}
                    {reportType === 'inventory' && 'Inventory Stock & Supplies Manifest'}
                    {reportType === 'donations' && 'Donations & Partner Aid Report'}
                  </h2>
                  <h5>City Disaster Risk Reduction and Management Office (CDRRMO)</h5>
                </div>
              </div>

              <div className="grm-sheet-meta">
                <div>
                  <strong>Report Date:</strong> {reportDateStr}
                </div>
                <div>
                  <strong>Prepared By:</strong> {operatorName} ({operatorRole})
                </div>
                <div>
                  <strong>Scope:</strong>{' '}
                  {timeframe === 'all'
                    ? 'Complete Record'
                    : timeframe === '24h'
                    ? 'Past 24 Hours'
                    : timeframe === '7d'
                    ? 'Past 7 Days'
                    : 'Past 30 Days'}
                </div>
              </div>
            </div>

            {/* KPI Summary Cards */}
            <div className="grm-kpi-grid">
              {reportType === 'summary' && (
                <>
                  <div className="grm-kpi-card">
                    <div className="grm-kpi-icon">📋</div>
                    <div className="grm-kpi-value">{reqTotal}</div>
                    <div className="grm-kpi-label">Total Requests ({reqCompleted} Done)</div>
                  </div>
                  <div className="grm-kpi-card">
                    <div className="grm-kpi-icon">👥</div>
                    <div className="grm-kpi-value">{totalBeneficiaries}</div>
                    <div className="grm-kpi-label">Affected Beneficiaries</div>
                  </div>
                  <div className={`grm-kpi-card ${invLowStock > 0 ? 'warn' : ''}`}>
                    <div className="grm-kpi-icon">📦</div>
                    <div className="grm-kpi-value">{invTotalQty}</div>
                    <div className="grm-kpi-label">Supplies Stock ({invLowStock} Low)</div>
                  </div>
                  <div className="grm-kpi-card success">
                    <div className="grm-kpi-icon">🎁</div>
                    <div className="grm-kpi-value">{donTotal}</div>
                    <div className="grm-kpi-label">Donations ({donAgencies} Donors)</div>
                  </div>
                </>
              )}

              {reportType === 'requests' && (
                <>
                  <div className="grm-kpi-card">
                    <div className="grm-kpi-icon">📋</div>
                    <div className="grm-kpi-value">{reqTotal}</div>
                    <div className="grm-kpi-label">Total Requests</div>
                  </div>
                  <div className="grm-kpi-card warn">
                    <div className="grm-kpi-icon">⏳</div>
                    <div className="grm-kpi-value">{reqPending}</div>
                    <div className="grm-kpi-label">Pending Review</div>
                  </div>
                  <div className="grm-kpi-card">
                    <div className="grm-kpi-icon">🚚</div>
                    <div className="grm-kpi-value">{reqInProgress}</div>
                    <div className="grm-kpi-label">In Progress</div>
                  </div>
                  <div className="grm-kpi-card success">
                    <div className="grm-kpi-icon">✅</div>
                    <div className="grm-kpi-value">{reqCompleted}</div>
                    <div className="grm-kpi-label">Completed</div>
                  </div>
                </>
              )}

              {reportType === 'inventory' && (
                <>
                  <div className="grm-kpi-card">
                    <div className="grm-kpi-icon">📦</div>
                    <div className="grm-kpi-value">{invTotalItems}</div>
                    <div className="grm-kpi-label">Item Types</div>
                  </div>
                  <div className="grm-kpi-card">
                    <div className="grm-kpi-icon">📊</div>
                    <div className="grm-kpi-value">{invTotalQty}</div>
                    <div className="grm-kpi-label">Total Units in Stock</div>
                  </div>
                  <div className={`grm-kpi-card ${invLowStock > 0 ? 'warn' : ''}`}>
                    <div className="grm-kpi-icon">⚠️</div>
                    <div className="grm-kpi-value">{invLowStock}</div>
                    <div className="grm-kpi-label">Items Low Stock (&le;10)</div>
                  </div>
                  <div className="grm-kpi-card success">
                    <div className="grm-kpi-icon">🛡️</div>
                    <div className="grm-kpi-value">
                      {Math.max(0, invTotalItems - invLowStock)}
                    </div>
                    <div className="grm-kpi-label">Healthy Stock Items</div>
                  </div>
                </>
              )}

              {reportType === 'donations' && (
                <>
                  <div className="grm-kpi-card">
                    <div className="grm-kpi-icon">🎁</div>
                    <div className="grm-kpi-value">{donTotal}</div>
                    <div className="grm-kpi-label">Total Donations</div>
                  </div>
                  <div className="grm-kpi-card success">
                    <div className="grm-kpi-icon">📦</div>
                    <div className="grm-kpi-value">{donTotalQty}</div>
                    <div className="grm-kpi-label">Total Units Donated</div>
                  </div>
                  <div className="grm-kpi-card">
                    <div className="grm-kpi-icon">🏢</div>
                    <div className="grm-kpi-value">{donAgencies}</div>
                    <div className="grm-kpi-label">Contributing Agencies</div>
                  </div>
                  <div className="grm-kpi-card">
                    <div className="grm-kpi-icon">📅</div>
                    <div className="grm-kpi-value">{donTotal > 0 ? 'Active' : '—'}</div>
                    <div className="grm-kpi-label">Donation Pipeline</div>
                  </div>
                </>
              )}
            </div>

            {/* Executive Summary Multi-Section Content */}
            {reportType === 'summary' && (
              <>
                <div className="grm-section">
                  <div className="grm-section-title">
                    <span>Recent Relief Requests</span>
                    <span className="grm-section-count">
                      Showing up to 6 of {reqTotal} requests
                    </span>
                  </div>
                  <div className="grm-table-wrap">
                    <table className="grm-table">
                      <thead>
                        <tr>
                          <th>Request ID</th>
                          <th>Location / Barangay</th>
                          <th>Family Members</th>
                          <th>Status</th>
                          <th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRequests.slice(0, 6).map((r) => (
                          <tr key={r.docId}>
                            <td><strong>{r.requestId}</strong></td>
                            <td>{r.location}</td>
                            <td>{r.familyMembers || 0} pax</td>
                            <td>
                              <span className={`grm-badge ${getStatusClass(r.status)}`}>
                                {getStatusLabel(r.status)}
                              </span>
                            </td>
                            <td>{formatRequestDate(r.createdAt)}</td>
                          </tr>
                        ))}
                        {filteredRequests.length === 0 && (
                          <tr>
                            <td colSpan="5" className="grm-empty-state">
                              No relief requests in this period.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="grm-section">
                  <div className="grm-section-title">
                    <span>Critical Inventory & Shortages</span>
                    <span className="grm-section-count">
                      {invLowStock > 0 ? `${invLowStock} items requiring restock` : 'All items well stocked'}
                    </span>
                  </div>
                  <div className="grm-table-wrap">
                    <table className="grm-table">
                      <thead>
                        <tr>
                          <th>Item Name</th>
                          <th>Category</th>
                          <th>Quantity</th>
                          <th>Storage Location</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredItems
                          .filter((i) => isLowStock(i.quantity))
                          .slice(0, 5)
                          .map((i) => (
                            <tr key={i.docId}>
                              <td><strong>{i.name}</strong></td>
                              <td>{getCategoryLabel(i.category)}</td>
                              <td><strong>{i.quantity} {i.unit || 'units'}</strong></td>
                              <td>{i.storageLocation || '—'}</td>
                              <td>
                                <span className="grm-badge low-stock">Low Stock</span>
                              </td>
                            </tr>
                          ))}
                        {invLowStock === 0 && (
                          <tr>
                            <td colSpan="5" className="grm-empty-state">
                              No low-stock supply shortages identified.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* Relief Requests Full Table */}
            {reportType === 'requests' && (
              <div className="grm-section">
                <div className="grm-section-title">
                  <span>Relief Requests Log</span>
                  <span className="grm-section-count">
                    {filteredRequests.length} record{filteredRequests.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="grm-table-wrap">
                  <table className="grm-table">
                    <thead>
                      <tr>
                        <th>Request ID</th>
                        <th>Requester</th>
                        <th>Location</th>
                        <th>Family Size</th>
                        <th>Evac Center</th>
                        <th>Status</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRequests.map((r) => (
                        <tr key={r.docId}>
                          <td><strong>{r.requestId}</strong></td>
                          <td>{r.requesterName || '—'}</td>
                          <td>{r.location}</td>
                          <td>{r.familyMembers ?? '—'}</td>
                          <td>{r.hasEvacuationCenter ? 'Yes' : 'No'}</td>
                          <td>
                            <span className={`grm-badge ${getStatusClass(r.status)}`}>
                              {getStatusLabel(r.status)}
                            </span>
                          </td>
                          <td>{formatRequestDate(r.createdAt)}</td>
                        </tr>
                      ))}
                      {filteredRequests.length === 0 && (
                        <tr>
                          <td colSpan="7" className="grm-empty-state">
                            No relief requests match the selected criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Inventory Full Table */}
            {reportType === 'inventory' && (
              <div className="grm-section">
                <div className="grm-section-title">
                  <span>Relief Goods & Supplies Inventory</span>
                  <span className="grm-section-count">
                    {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="grm-table-wrap">
                  <table className="grm-table">
                    <thead>
                      <tr>
                        <th>Item ID</th>
                        <th>Item Name</th>
                        <th>Category</th>
                        <th>Quantity</th>
                        <th>Unit</th>
                        <th>Storage Location</th>
                        <th>Stock Alert</th>
                        <th>Last Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems.map((i) => {
                        const low = isLowStock(i.quantity)
                        return (
                          <tr key={i.docId}>
                            <td><strong>{i.itemId}</strong></td>
                            <td>{i.name}</td>
                            <td>{getCategoryLabel(i.category)}</td>
                            <td><strong>{i.quantity}</strong></td>
                            <td>{i.unit || '—'}</td>
                            <td>{i.storageLocation || '—'}</td>
                            <td>
                              <span className={`grm-badge ${low ? 'low-stock' : 'good-stock'}`}>
                                {low ? 'Low Stock' : 'Sufficient'}
                              </span>
                            </td>
                            <td>{formatInventoryDate(i.updatedAt || i.createdAt)}</td>
                          </tr>
                        )
                      })}
                      {filteredItems.length === 0 && (
                        <tr>
                          <td colSpan="8" className="grm-empty-state">
                            No inventory items logged.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Donations Full Table */}
            {reportType === 'donations' && (
              <div className="grm-section">
                <div className="grm-section-title">
                  <span>Donations & Inbound Aid Records</span>
                  <span className="grm-section-count">
                    {filteredDonations.length} entry{filteredDonations.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="grm-table-wrap">
                  <table className="grm-table">
                    <thead>
                      <tr>
                        <th>Agency / Donor</th>
                        <th>Type</th>
                        <th>Item Description</th>
                        <th>Quantity</th>
                        <th>Unit</th>
                        <th>Date Received</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDonations.map((d) => (
                        <tr key={d.docId}>
                          <td><strong>{d.agency}</strong></td>
                          <td>{d.type}</td>
                          <td>{d.items || '—'}</td>
                          <td><strong>{d.quantity}</strong></td>
                          <td>{d.unit || '—'}</td>
                          <td>{formatRequestDate(d.createdAt)}</td>
                          <td>{d.notes || '—'}</td>
                        </tr>
                      ))}
                      {filteredDonations.length === 0 && (
                        <tr>
                          <td colSpan="7" className="grm-empty-state">
                            No donations recorded for this period.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Certification & Signatures Section (Visible in screen and print) */}
            <div className="grm-signatures">
              <div className="grm-sign-box">
                <span className="grm-sign-label">Prepared By</span>
                <div className="grm-sign-line" />
                <span className="grm-sign-name">{operatorName}</span>
                <span className="grm-sign-title">{operatorRole}, Relief Operations</span>
              </div>
              <div className="grm-sign-box">
                <span className="grm-sign-label">Verified By</span>
                <div className="grm-sign-line" />
                <span className="grm-sign-name">Logistics & Distribution Lead</span>
                <span className="grm-sign-title">City Social Welfare & Dev. (CSWDO)</span>
              </div>
              <div className="grm-sign-box">
                <span className="grm-sign-label">Approved By</span>
                <div className="grm-sign-line" />
                <span className="grm-sign-name">CDRRMO Executive Director</span>
                <span className="grm-sign-title">City Government of Naga</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
