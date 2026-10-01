// ════════════════════════════════════════════════════════════════
//  SIH26105 — Simulated Demo Data
//  Inspired by real CVE/NVD severity distributions and the
//  Cybersecurity Hackathon Dataset provided with this project.
//  ALL values are synthetic — no real enterprise data is stored.
// ════════════════════════════════════════════════════════════════

// ── Security Controls ────────────────────────────────────────────
// Each control has: id, name, cost (₹), effectiveness (fraction of
// remaining exposure reduced), category, description
const controls = [
  { id: 'FW',  name: 'Firewall Upgrade',            cost: 150000, eff: 0.12, cat: 'Network',   desc: 'Next-gen stateful inspection with IPS signatures' },
  { id: 'EDR', name: 'EDR Deployment',               cost: 200000, eff: 0.18, cat: 'Endpoint',  desc: 'Endpoint Detection & Response across all workstations' },
  { id: 'IAM', name: 'IAM / MFA Improvement',        cost: 120000, eff: 0.10, cat: 'Identity',  desc: 'Enforce MFA, RBAC, and privileged-access management' },
  { id: 'SEG', name: 'Network Segmentation',          cost: 180000, eff: 0.16, cat: 'Network',   desc: 'Micro-segmentation limiting lateral movement' },
  { id: 'FRD', name: 'Fraud Monitoring AI',           cost: 250000, eff: 0.22, cat: 'Detection', desc: 'Real-time ML anomaly detection on payment transactions' },
  { id: 'SOC', name: '24×7 SOC Monitoring',           cost: 200000, eff: 0.18, cat: 'Detection', desc: 'Managed SOC with SIEM correlation and playbooks (overlaps EDR)' },
  { id: 'BDR', name: 'Backup & Disaster Recovery',    cost: 150000, eff: 0.12, cat: 'Resilience',desc: 'Immutable off-site backups; 4-hour RTO' },
  { id: 'AWR', name: 'Security Awareness Training',   cost:  50000, eff: 0.05, cat: 'People',    desc: 'Phishing simulations and mandatory e-learning modules' },
];

// ── Asset Inventory ───────────────────────────────────────────────
// Fields: name, type, ip, service, crit, cves, cvss, value (₹), risk (0-10)
// Additional dataset-driven fields: owner, patchStatus, lastScan, slaHours
const assets = [
  ['Payment API',          'API',      '10.0.1.12',       'Payments',     'Critical', 6, 9.8, 2800000, 9.2, 'Payments Team',  'Unpatched',     '2024-03-10', 4  ],
  ['Transaction Database', 'Database', '10.0.2.20',       'Payments',     'Critical', 5, 8.1, 3500000, 7.8, 'DBA Team',       'Partial',       '2024-03-12', 4  ],
  ['Banking Core Service', 'Service',  '10.0.3.5',        'Core Banking', 'Critical', 4, 7.5, 1720000, 6.5, 'Core Banking',   'Patched',       '2024-03-14', 8  ],
  ['Authentication Server','Server',   '10.0.1.4',        'Identity',     'Critical', 3, 7.2,  900000, 6.1, 'IAM Team',       'Partial',       '2024-03-11', 4  ],
  ['Customer Database',    'Database', '10.0.2.31',       'CRM',          'High',     4, 7.0, 1500000, 5.9, 'CRM Team',       'Partial',       '2024-03-15', 8  ],
  ['Admin Portal',         'Web App',  '10.0.4.9',        'Operations',   'High',     3, 6.4,  600000, 4.3, 'Ops Team',       'Patched',       '2024-03-16', 24 ],
  ['Cloud Storage Bucket', 'Cloud',    '172.16.0.8',      'Data Lake',    'High',     2, 6.1,  750000, 4.0, 'Cloud Team',     'Unpatched',     '2024-03-09', 24 ],
  ['API Gateway',          'Network',  '10.0.1.1',        'Infrastructure','Medium',  2, 5.8,  400000, 3.8, 'Infra Team',     'Patched',       '2024-03-17', 48 ],
  ['SIEM Platform',        'Security', '10.0.6.10',       'Security Ops', 'Medium',   1, 5.3,  350000, 3.4, 'SOC Team',       'Patched',       '2024-03-18', 48 ],
  ['Employee Endpoints',   'Endpoint', '192.168.0.0/24',  'Workplace',    'Medium',   9, 5.0,  300000, 2.9, 'IT Helpdesk',    'Mixed',         '2024-03-13', 72 ],
  ['Email Server',         'Server',   '10.0.5.2',        'Messaging',    'Medium',   2, 4.2,  200000, 2.1, 'Messaging Team', 'Patched',       '2024-03-19', 48 ],
  ['Dev / Test Environment','Server',  '192.168.10.0/24', 'Development',  'Low',      7, 4.8,   80000, 1.8, 'Dev Team',       'Unpatched',     '2024-03-08', 168],
].map(a => ({
  name: a[0], type: a[1], ip: a[2], service: a[3], crit: a[4],
  cves: a[5], cvss: a[6], value: a[7], risk: a[8],
  owner: a[9], patchStatus: a[10], lastScan: a[11], slaHours: a[12],
}));

// ── Attack Propagation Chain ─────────────────────────────────────
// [id, label, baseExposure (₹)]
const chain = [
  ['customer',   'Customer',          0],
  ['gateway',    'Payment Gateway',   200000],
  ['paymentapi', 'Payment API',       828000],
  ['order',      'Order Service',     250000],
  ['txdb',       'Transaction DB',    350000],
  ['banking',    'Banking Service',   172000],
  ['revenue',    'Revenue Impact',    0],
];

// ── Historical trend data (last 12 months, simulated) ────────────
const trend = [
  { month: 'Apr',  score: 62, exposure: 1100000 },
  { month: 'May',  score: 65, exposure: 1180000 },
  { month: 'Jun',  score: 70, exposure: 1350000 },
  { month: 'Jul',  score: 68, exposure: 1280000 },
  { month: 'Aug',  score: 73, exposure: 1490000 },
  { month: 'Sep',  score: 71, exposure: 1420000 },
  { month: 'Oct',  score: 75, exposure: 1550000 },
  { month: 'Nov',  score: 74, exposure: 1530000 },
  { month: 'Dec',  score: 78, exposure: 1680000 },
  { month: 'Jan',  score: 76, exposure: 1600000 },
  { month: 'Feb',  score: 80, exposure: 1750000 },
  { month: 'Mar',  score: 78, exposure: 1800000 },
];

// ── Threat Intelligence feed (simulated) ─────────────────────────
const threats = [
  { id: 'CVE-2024-21762', cvss: 9.8, category: 'RCE',          affected: 'Payment API',    status: 'Active',   source: 'NVD' },
  { id: 'CVE-2024-20356', cvss: 8.6, category: 'Privilege Esc',affected: 'Auth Server',    status: 'Patched',  source: 'NVD' },
  { id: 'CVE-2023-44487', cvss: 7.5, category: 'DoS (HTTP/2)', affected: 'API Gateway',    status: 'Active',   source: 'NVD' },
  { id: 'CVE-2024-3094',  cvss: 10,  category: 'Supply Chain', affected: 'Dev Environment',status: 'Mitigated',source: 'NVD' },
  { id: 'CVE-2023-4966',  cvss: 9.4, category: 'Info Disc',    affected: 'Admin Portal',   status: 'Active',   source: 'NVD' },
  { id: 'CVE-2024-27198', cvss: 9.8, category: 'Auth Bypass',  affected: 'Cloud Storage',  status: 'Unpatched',source: 'NVD' },
];

module.exports = { controls, assets, chain, trend, threats };
