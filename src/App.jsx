import React, { useState, useEffect, useMemo } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import {
  Wallet, TrendingUp, Sliders, ShieldCheck, AlertTriangle, Sparkles,
  ArrowRight, Sun, Moon, Users, UserPlus, Receipt, Calculator, Plus,
  Trash2, ArrowLeftRight, Landmark, Scale, BadgePercent, ChevronRight,
  Banknote, CircleDollarSign, Check, PiggyBank
} from 'lucide-react';

ChartJS.register(ArcElement, Tooltip, Legend);

/* ═══════════════════════════════════════════════════════
   UTILITY HELPERS
   ═══════════════════════════════════════════════════════ */
let _id = 0;
const uid = () => `_${++_id}_${Date.now()}`;
const fmt = (n) => Number(n).toLocaleString('en-IN');

/* ─── Indian Old Regime Tax (FY 2024-25) ─── */
function calcOldTax(gross, ded) {
  const std = 50000;
  const s80c = Math.min(Math.max(ded.s80c || 0, 0), 150000);
  const s80d = Math.min(Math.max(ded.s80d || 0, 0), 50000);
  const hra = Math.max(ded.hra || 0, 0);
  const other = Math.max(ded.other || 0, 0);
  const totalDed = std + s80c + s80d + hra + other;
  const taxable = Math.max(0, gross - totalDed);

  let tax = 0;
  if (taxable > 1000000) tax += (taxable - 1000000) * 0.30;
  if (taxable > 500000) tax += (Math.min(taxable, 1000000) - 500000) * 0.20;
  if (taxable > 250000) tax += (Math.min(taxable, 500000) - 250000) * 0.05;
  if (taxable <= 500000) tax = 0; // 87A rebate
  const cess = tax * 0.04;
  return { taxable, deductions: totalDed, tax, cess, total: tax + cess };
}

/* ─── Indian New Regime Tax (FY 2024-25) ─── */
function calcNewTax(gross) {
  const std = 75000;
  const taxable = Math.max(0, gross - std);

  let tax = 0;
  if (taxable > 1500000) tax += (taxable - 1500000) * 0.30;
  if (taxable > 1200000) tax += (Math.min(taxable, 1500000) - 1200000) * 0.20;
  if (taxable > 1000000) tax += (Math.min(taxable, 1200000) - 1000000) * 0.15;
  if (taxable > 700000) tax += (Math.min(taxable, 1000000) - 700000) * 0.10;
  if (taxable > 300000) tax += (Math.min(taxable, 700000) - 300000) * 0.05;
  if (taxable <= 700000) tax = 0; // 87A rebate
  const cess = tax * 0.04;
  return { taxable, deductions: std, tax, cess, total: tax + cess };
}

/* ─── Splitwise Settlement Algorithm ─── */
function calcSettlements(people, expenses) {
  if (!people.length || !expenses.length) return { balances: {}, settlements: [] };

  const balances = {};
  people.forEach(p => (balances[p.id] = 0));

  expenses.forEach(exp => {
    if (!exp.splitAmong.length) return;
    const share = exp.amount / exp.splitAmong.length;
    if (balances[exp.paidBy] !== undefined) balances[exp.paidBy] += exp.amount;
    exp.splitAmong.forEach(pid => {
      if (balances[pid] !== undefined) balances[pid] -= share;
    });
  });

  const debtors = [];
  const creditors = [];
  Object.entries(balances).forEach(([id, bal]) => {
    if (bal < -0.01) debtors.push({ id, amount: -bal });
    if (bal > 0.01) creditors.push({ id, amount: bal });
  });
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const settlements = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amt = Math.min(debtors[i].amount, creditors[j].amount);
    settlements.push({ from: debtors[i].id, to: creditors[j].id, amount: +(amt.toFixed(2)) });
    debtors[i].amount -= amt;
    creditors[j].amount -= amt;
    if (debtors[i].amount < 0.01) i++;
    if (creditors[j].amount < 0.01) j++;
  }

  return { balances, settlements };
}

/* ═══════════════════════════════════════════════════════
   MAIN APP COMPONENT
   ═══════════════════════════════════════════════════════ */
export default function App() {

  /* ─── Theme ─── */
  const [theme, setTheme] = useState(() => localStorage.getItem('fg-theme') || 'dark');
  const toggleTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'));
  const dc = (d, l) => (theme === 'dark' ? d : l);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('fg-theme', theme);
  }, [theme]);

  /* ─── Navigation ─── */
  const [activeTab, setActiveTab] = useState('budget');
  const tabs = [
    { key: 'budget', label: 'Budget', Icon: Wallet },
    { key: 'splitwise', label: 'Splitwise', Icon: Users },
    { key: 'taxes', label: 'Taxes', Icon: Calculator },
  ];

  /* ═══════ BUDGET STATE ═══════ */
  const [income, setIncome] = useState(5000);
  const [fixedExpenses, setFixedExpenses] = useState(2500);
  const [needsRatio, setNeedsRatio] = useState(50);
  const [wantsRatio, setWantsRatio] = useState(30);
  const [savingsRatio, setSavingsRatio] = useState(20);

  const totalRatio = Number(needsRatio) + Number(wantsRatio) + Number(savingsRatio);
  const isRatioValid = totalRatio === 100;
  const disposableIncome = Math.max(0, income - fixedExpenses);
  const nR = isRatioValid ? needsRatio : 50;
  const wR = isRatioValid ? wantsRatio : 30;
  const sR = isRatioValid ? savingsRatio : 20;
  const suggestedNeeds = income * (nR / 100);
  const suggestedWants = income * (wR / 100);
  const suggestedSavings = income * (sR / 100);
  const isOverBudget = fixedExpenses > suggestedNeeds;

  /* ═══════ SPLITWISE STATE ═══════ */
  const [swPeople, setSwPeople] = useState(() => [
    { id: uid(), name: 'You' },
    { id: uid(), name: 'Friend' },
  ]);
  const [swExpenses, setSwExpenses] = useState([]);
  const [swNewName, setSwNewName] = useState('');
  const [swDesc, setSwDesc] = useState('');
  const [swAmt, setSwAmt] = useState('');
  const [swPaidBy, setSwPaidBy] = useState('');
  const [swSplit, setSwSplit] = useState([]);

  /* Auto-set defaults when people change */
  useEffect(() => {
    if (swPeople.length) {
      if (!swPaidBy || !swPeople.find(p => p.id === swPaidBy)) {
        setSwPaidBy(swPeople[0].id);
      }
      setSwSplit(swPeople.map(p => p.id));
    } else {
      setSwPaidBy('');
      setSwSplit([]);
    }
  }, [swPeople.length]);

  const { balances, settlements } = useMemo(
    () => calcSettlements(swPeople, swExpenses),
    [swPeople, swExpenses]
  );
  const totalGroupExpenses = swExpenses.reduce((s, e) => s + e.amount, 0);
  const getName = (id) => swPeople.find(p => p.id === id)?.name || '?';

  const addPerson = () => {
    const name = swNewName.trim();
    if (!name) return;
    setSwPeople(p => [...p, { id: uid(), name }]);
    setSwNewName('');
  };
  const removePerson = (id) => {
    setSwPeople(p => p.filter(x => x.id !== id));
    setSwExpenses(e =>
      e.filter(x => x.paidBy !== id)
        .map(x => ({ ...x, splitAmong: x.splitAmong.filter(pid => pid !== id) }))
    );
  };
  const addExpense = () => {
    const amt = parseFloat(swAmt);
    if (!swDesc.trim() || isNaN(amt) || amt <= 0 || !swPaidBy || !swSplit.length) return;
    setSwExpenses(e => [...e, {
      id: uid(), description: swDesc.trim(), amount: amt,
      paidBy: swPaidBy, splitAmong: [...swSplit],
    }]);
    setSwDesc('');
    setSwAmt('');
  };
  const removeExpense = (id) => setSwExpenses(e => e.filter(x => x.id !== id));
  const toggleSplit = (pid) => {
    setSwSplit(s => s.includes(pid) ? s.filter(x => x !== pid) : [...s, pid]);
  };

  /* ═══════ TAX STATE ═══════ */
  const [taxGross, setTaxGross] = useState(1000000);
  const [ded80c, setDed80c] = useState(150000);
  const [ded80d, setDed80d] = useState(25000);
  const [dedHra, setDedHra] = useState(0);
  const [dedOther, setDedOther] = useState(0);

  const oldTax = useMemo(
    () => calcOldTax(taxGross, { s80c: ded80c, s80d: ded80d, hra: dedHra, other: dedOther }),
    [taxGross, ded80c, ded80d, dedHra, dedOther]
  );
  const newTax = useMemo(() => calcNewTax(taxGross), [taxGross]);
  const betterRegime = oldTax.total <= newTax.total ? 'old' : 'new';
  const taxSavings = Math.abs(oldTax.total - newTax.total);

  /* ═══════ CHART CONFIG ═══════ */
  const chartData = {
    labels: ['Needs', 'Wants', 'Savings'],
    datasets: [{
      data: [suggestedNeeds, suggestedWants, suggestedSavings],
      backgroundColor: [
        'rgba(99, 102, 241, 0.85)',
        'rgba(245, 158, 11, 0.85)',
        'rgba(34, 197, 94, 0.85)',
      ],
      borderColor: [
        'rgba(99, 102, 241, 1)',
        'rgba(245, 158, 11, 1)',
        'rgba(34, 197, 94, 1)',
      ],
      borderWidth: 2,
      hoverOffset: 8,
      hoverBorderWidth: 3,
    }],
  };

  const chartOptions = {
    cutout: '72%',
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: dc('rgba(15, 23, 42, 0.95)', 'rgba(255, 255, 255, 0.95)'),
        titleColor: dc('#F1F5F9', '#0F172A'),
        bodyColor: dc('#94A3B8', '#475569'),
        borderColor: 'rgba(99, 102, 241, 0.3)',
        borderWidth: 1,
        cornerRadius: 12,
        padding: 14,
        titleFont: { size: 14, weight: '600' },
        bodyFont: { size: 13 },
        callbacks: {
          label: (ctx) => ` ₹${ctx.parsed.toLocaleString('en-IN')}`,
        },
      },
    },
  };

  /* ═══════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen font-sans relative">
      {/* Animated Mesh Background */}
      <div className="bg-mesh" />

      {/* ═══════ NAVBAR ═══════ */}
      <nav className="nav-glass sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-indigo-500 to-cyan-500 p-2.5 rounded-xl text-white shadow-lg shadow-indigo-500/20">
                <Wallet size={22} />
              </div>
              <span className={`font-bold text-xl tracking-tight ${dc('text-white', 'text-slate-900')}`}>
                Fin<span className="gradient-text">Guide</span>
              </span>
            </div>

            {/* Tab Navigation */}
            <div className="flex items-center gap-1">
              {tabs.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`tab-btn ${activeTab === key ? 'tab-btn-active' : ''}`}
                >
                  <Icon size={16} />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>

            {/* Theme Toggle */}
            <button onClick={toggleTheme} className="theme-toggle" aria-label="Toggle theme">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
      </nav>

      {/* ═══════════════════════════════════════════════════
         BUDGET TAB
         ═══════════════════════════════════════════════════ */}
      {activeTab === 'budget' && (
        <div key="budget" className="animate-tab-enter">
          {/* Hero */}
          <header className="hero-glow relative z-10 pt-20 pb-16 text-center">
            <div className="max-w-3xl mx-auto px-4 animate-fade-in-up">
              <div className="pill-badge mb-6 mx-auto w-fit">
                <TrendingUp size={12} />
                50 / 30 / 20 Budgeting Rule
              </div>
              <h1 className={`text-4xl md:text-6xl font-extrabold tracking-tight mb-5 leading-tight ${dc('text-white', 'text-slate-900')}`}>
                Master Your Money,{' '}
                <span className="gradient-text">Effortlessly.</span>
              </h1>
              <p className={`text-lg mb-8 max-w-2xl mx-auto leading-relaxed ${dc('text-slate-400', 'text-slate-500')}`}>
                Take control of your finances with a clear, dynamic budget. Enter your income,
                adjust your ratios, and see exactly where your money should go.
              </p>
              <div className={`flex items-center justify-center gap-2 text-sm ${dc('text-slate-500', 'text-slate-400')}`}>
                <ArrowRight size={14} className="animate-float" />
                <span>Scroll down to start planning</span>
              </div>
            </div>
          </header>

          {/* Dashboard */}
          <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

              {/* LEFT: INPUTS */}
              <div className="lg:col-span-5 space-y-6">

                {/* Financial Inputs */}
                <div className="glass-card p-7 animate-fade-in-up delay-100">
                  <h2 className="text-lg font-bold mb-6 flex items-center gap-2.5">
                    <div className="section-icon"><TrendingUp size={18} /></div>
                    Financial Inputs
                  </h2>
                  <div className="space-y-5">
                    <div>
                      <label className={`block text-sm font-semibold mb-2.5 ${dc('text-slate-300', 'text-slate-600')}`}>
                        Monthly Net Income
                      </label>
                      <div className="relative">
                        <span className={`absolute left-4 top-1/2 -translate-y-1/2 font-semibold ${dc('text-slate-500', 'text-slate-400')}`}>₹</span>
                        <input type="number" value={income} onChange={e => setIncome(Number(e.target.value))} className="input-field pl-9" placeholder="e.g. 5000" />
                      </div>
                    </div>
                    <div>
                      <label className={`block text-sm font-semibold mb-2.5 ${dc('text-slate-300', 'text-slate-600')}`}>
                        Total Fixed Expenses
                      </label>
                      <div className="relative">
                        <span className={`absolute left-4 top-1/2 -translate-y-1/2 font-semibold ${dc('text-slate-500', 'text-slate-400')}`}>₹</span>
                        <input type="number" value={fixedExpenses} onChange={e => setFixedExpenses(Number(e.target.value))} className="input-field pl-9" placeholder="e.g. 2500" />
                      </div>
                      <p className={`text-xs mt-2.5 ml-1 ${dc('text-slate-500', 'text-slate-400')}`}>
                        Rent, utilities, insurance, minimum payments.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Ratio Adjustment */}
                <div className="glass-card p-7 animate-fade-in-up delay-200">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-bold flex items-center gap-2.5">
                      <div className="section-icon"><Sliders size={18} /></div>
                      Adjust Ratios
                    </h2>
                    {!isRatioValid && (
                      <span className="text-xs font-bold text-red-400 bg-red-500/10 px-3 py-1.5 rounded-full border border-red-500/20">
                        Total must be 100%
                      </span>
                    )}
                  </div>
                  <div className="space-y-5">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-indigo-400 mb-2 uppercase tracking-wider">Needs</label>
                        <input type="number" value={needsRatio} onChange={e => setNeedsRatio(e.target.value)} className={`input-ratio ${!isRatioValid ? 'error' : ''}`} />
                        <span className={`block text-center text-xs mt-1 ${dc('text-slate-500', 'text-slate-400')}`}>%</span>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-amber-400 mb-2 uppercase tracking-wider">Wants</label>
                        <input type="number" value={wantsRatio} onChange={e => setWantsRatio(e.target.value)} className={`input-ratio ${!isRatioValid ? 'error' : ''}`} />
                        <span className={`block text-center text-xs mt-1 ${dc('text-slate-500', 'text-slate-400')}`}>%</span>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-green-400 mb-2 uppercase tracking-wider">Savings</label>
                        <input type="number" value={savingsRatio} onChange={e => setSavingsRatio(e.target.value)} className={`input-ratio ${!isRatioValid ? 'error' : ''}`} />
                        <span className={`block text-center text-xs mt-1 ${dc('text-slate-500', 'text-slate-400')}`}>%</span>
                      </div>
                    </div>
                    <div className="ratio-bar mt-4">
                      <div style={{ width: `${needsRatio}%` }} className="bg-indigo-500 rounded-l-full" />
                      <div style={{ width: `${wantsRatio}%` }} className="bg-amber-500" />
                      <div style={{ width: `${savingsRatio}%` }} className="bg-green-500 rounded-r-full" />
                    </div>
                    <div className={`flex justify-between text-xs px-1 ${dc('text-slate-500', 'text-slate-400')}`}>
                      <span>{needsRatio}%</span>
                      <span>{wantsRatio}%</span>
                      <span>{savingsRatio}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT: ANALYTICS */}
              <div className="lg:col-span-7 space-y-6">

                {/* Summary Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Disposable Income */}
                  <div className="stat-card animate-fade-in-up delay-200">
                    <div className="relative z-10">
                      <p className="text-white/60 text-sm font-medium mb-1">Disposable Income</p>
                      <h3 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
                        ₹{disposableIncome.toLocaleString('en-IN')}
                      </h3>
                      <p className="text-white/40 text-xs mt-3 flex items-center gap-1.5">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-white/40" />
                        After fixed expenses
                      </p>
                    </div>
                  </div>

                  {/* Financial Health */}
                  <div className={`health-card animate-fade-in-up delay-300 ${isOverBudget ? 'health-bad' : 'health-good'}`}>
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-xl ${isOverBudget ? 'bg-red-500/15 text-red-400' : 'bg-green-500/15 text-green-400'}`}>
                        {isOverBudget ? <AlertTriangle size={22} /> : <ShieldCheck size={22} />}
                      </div>
                      <div>
                        <h3 className={`font-bold text-sm ${isOverBudget ? 'text-red-400' : 'text-green-400'}`}>
                          {isOverBudget ? 'Over Budget!' : 'Looking Good!'}
                        </h3>
                        <p className={`text-xs mt-1.5 leading-relaxed ${isOverBudget ? 'text-red-300/70' : 'text-green-300/70'}`}>
                          {isOverBudget
                            ? `Fixed expenses (₹${fixedExpenses.toLocaleString('en-IN')}) exceed your needs allocation (₹${suggestedNeeds.toLocaleString('en-IN')}).`
                            : `Fixed expenses (₹${fixedExpenses.toLocaleString('en-IN')}) are within your needs target (₹${suggestedNeeds.toLocaleString('en-IN')}). Nice work!`}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Allocations Chart */}
                <div className="glass-card p-7 animate-fade-in-up delay-400">
                  <h2 className="text-lg font-bold mb-8 flex items-center gap-2.5">
                    <div className="section-icon"><Sparkles size={18} /></div>
                    Suggested Allocations
                  </h2>
                  <div className="flex flex-col md:flex-row items-center gap-10">
                    {/* Donut */}
                    <div className="w-full md:w-1/2 max-w-[240px] relative chart-container">
                      <Doughnut data={chartData} options={chartOptions} />
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="text-center">
                          <span className={`block text-2xl font-extrabold ${dc('text-white', 'text-slate-900')}`}>
                            ₹{income.toLocaleString('en-IN')}
                          </span>
                          <span className={`text-[10px] uppercase tracking-[0.15em] font-semibold ${dc('text-slate-400', 'text-slate-500')}`}>
                            Monthly
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Rows */}
                    <div className="w-full md:w-1/2 space-y-2">
                      {[
                        { label: 'Needs', pct: nR, val: suggestedNeeds, color: 'bg-indigo-500', shadow: 'shadow-indigo-500/30' },
                        { label: 'Wants', pct: wR, val: suggestedWants, color: 'bg-amber-500', shadow: 'shadow-amber-500/30' },
                        { label: 'Savings', pct: sR, val: suggestedSavings, color: 'bg-green-500', shadow: 'shadow-green-500/30' },
                      ].map((item, i) => (
                        <React.Fragment key={item.label}>
                          {i > 0 && <div className="th-divider" />}
                          <div className="alloc-row">
                            <div className="flex items-center gap-3">
                              <div className={`w-3 h-3 rounded-full ${item.color} shadow-lg ${item.shadow}`} />
                              <div>
                                <p className={`font-semibold text-sm ${dc('text-slate-200', 'text-slate-700')}`}>{item.label}</p>
                                <p className={`text-xs ${dc('text-slate-500', 'text-slate-400')}`}>{item.pct}% of income</p>
                              </div>
                            </div>
                            <span className={`font-bold tabular-nums ${dc('text-white', 'text-slate-900')}`}>
                              ₹{item.val.toLocaleString('en-IN')}
                            </span>
                          </div>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
         SPLITWISE TAB
         ═══════════════════════════════════════════════════ */}
      {activeTab === 'splitwise' && (
        <div key="splitwise" className="animate-tab-enter">
          {/* Header */}
          <header className="hero-glow relative z-10 pt-16 pb-12 text-center">
            <div className="max-w-3xl mx-auto px-4 animate-fade-in-up">
              <div className="pill-badge mb-4 mx-auto w-fit">
                <Users size={12} />
                Expense Splitter
              </div>
              <h1 className={`text-3xl md:text-5xl font-extrabold tracking-tight mb-4 ${dc('text-white', 'text-slate-900')}`}>
                Split Expenses, <span className="gradient-text">Fairly.</span>
              </h1>
              <p className={`text-base max-w-xl mx-auto leading-relaxed ${dc('text-slate-400', 'text-slate-500')}`}>
                Track shared expenses with friends, see balances at a glance, and get smart settlement suggestions.
              </p>
            </div>
          </header>

          <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

              {/* LEFT: People & Add Expense */}
              <div className="lg:col-span-5 space-y-6">

                {/* People */}
                <div className="glass-card p-7 animate-fade-in-up delay-100">
                  <h2 className="text-lg font-bold mb-5 flex items-center gap-2.5">
                    <div className="section-icon"><UserPlus size={18} /></div>
                    People
                  </h2>
                  {/* People List */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {swPeople.map(p => (
                      <div key={p.id} className="person-chip">
                        <span>{p.name}</span>
                        <button onClick={() => removePerson(p.id)} className="text-red-400 hover:text-red-300 transition-colors" aria-label={`Remove ${p.name}`}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                  {/* Add Person */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={swNewName}
                      onChange={e => setSwNewName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addPerson()}
                      className="input-field text-sm"
                      placeholder="Add a person…"
                    />
                    <button onClick={addPerson} className="btn-primary px-4 flex-shrink-0" disabled={!swNewName.trim()}>
                      <Plus size={16} />
                    </button>
                  </div>
                </div>

                {/* Add Expense */}
                <div className="glass-card p-7 animate-fade-in-up delay-200">
                  <h2 className="text-lg font-bold mb-5 flex items-center gap-2.5">
                    <div className="section-icon"><Receipt size={18} /></div>
                    Add Expense
                  </h2>
                  <div className="space-y-4">
                    <div>
                      <label className={`block text-xs font-semibold mb-2 ${dc('text-slate-400', 'text-slate-500')}`}>Description</label>
                      <input type="text" value={swDesc} onChange={e => setSwDesc(e.target.value)} className="input-field text-sm" placeholder="e.g. Dinner, Uber ride…" />
                    </div>
                    <div>
                      <label className={`block text-xs font-semibold mb-2 ${dc('text-slate-400', 'text-slate-500')}`}>Amount (₹)</label>
                      <div className="relative">
                        <span className={`absolute left-4 top-1/2 -translate-y-1/2 font-semibold text-sm ${dc('text-slate-500', 'text-slate-400')}`}>₹</span>
                        <input type="number" value={swAmt} onChange={e => setSwAmt(e.target.value)} className="input-field pl-9 text-sm" placeholder="0" />
                      </div>
                    </div>
                    <div>
                      <label className={`block text-xs font-semibold mb-2 ${dc('text-slate-400', 'text-slate-500')}`}>Paid by</label>
                      <select value={swPaidBy} onChange={e => setSwPaidBy(e.target.value)} className="input-select">
                        {swPeople.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={`block text-xs font-semibold mb-2 ${dc('text-slate-400', 'text-slate-500')}`}>Split among</label>
                      <div className="flex flex-wrap gap-2">
                        {swPeople.map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => toggleSplit(p.id)}
                            className={`split-checkbox ${swSplit.includes(p.id) ? 'active' : ''}`}
                          >
                            <div className="split-check-dot">
                              {swSplit.includes(p.id) && <Check size={11} className="text-white" />}
                            </div>
                            {p.name}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={addExpense}
                      className="btn-primary w-full"
                      disabled={!swDesc.trim() || !swAmt || !swPaidBy || !swSplit.length}
                    >
                      <Plus size={16} /> Add Expense
                    </button>
                  </div>
                </div>
              </div>

              {/* RIGHT: Expenses + Balances + Settlements */}
              <div className="lg:col-span-7 space-y-6">

                {/* Total Stat */}
                <div className="stat-card animate-fade-in-up delay-200">
                  <div className="relative z-10">
                    <p className="text-white/60 text-sm font-medium mb-1">Total Group Expenses</p>
                    <h3 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
                      ₹{totalGroupExpenses.toLocaleString('en-IN')}
                    </h3>
                    <p className="text-white/40 text-xs mt-3 flex items-center gap-1.5">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-white/40" />
                      {swExpenses.length} expense{swExpenses.length !== 1 ? 's' : ''} · {swPeople.length} people
                    </p>
                  </div>
                </div>

                {/* Expense List */}
                <div className="glass-card p-7 animate-fade-in-up delay-300">
                  <h2 className="text-lg font-bold mb-5 flex items-center gap-2.5">
                    <div className="section-icon"><Banknote size={18} /></div>
                    Expenses
                  </h2>
                  {swExpenses.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-state-icon mx-auto">
                        <Receipt size={28} />
                      </div>
                      <p className={`text-sm font-medium ${dc('text-slate-400', 'text-slate-500')}`}>No expenses yet</p>
                      <p className={`text-xs mt-1 ${dc('text-slate-500', 'text-slate-400')}`}>Add your first shared expense above</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {swExpenses.map(exp => (
                        <div key={exp.id} className="expense-row">
                          <div className="flex-1 min-w-0">
                            <p className={`font-semibold text-sm truncate ${dc('text-slate-200', 'text-slate-700')}`}>
                              {exp.description}
                            </p>
                            <p className={`text-xs mt-0.5 ${dc('text-slate-500', 'text-slate-400')}`}>
                              Paid by <span className="font-semibold text-indigo-400">{getName(exp.paidBy)}</span>
                              {' · '}Split {exp.splitAmong.length} way{exp.splitAmong.length !== 1 ? 's' : ''}
                            </p>
                          </div>
                          <span className={`font-bold tabular-nums text-sm ${dc('text-white', 'text-slate-900')}`}>
                            ₹{exp.amount.toLocaleString('en-IN')}
                          </span>
                          <button onClick={() => removeExpense(exp.id)} className="btn-danger-sm">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Balances */}
                {swExpenses.length > 0 && (
                  <div className="glass-card p-7 animate-fade-in-up delay-400">
                    <h2 className="text-lg font-bold mb-5 flex items-center gap-2.5">
                      <div className="section-icon"><Scale size={18} /></div>
                      Balances
                    </h2>
                    <div className="space-y-3">
                      {swPeople.map(p => {
                        const bal = balances[p.id] || 0;
                        const isPositive = bal > 0.01;
                        const isNegative = bal < -0.01;
                        return (
                          <div key={p.id} className="flex items-center justify-between">
                            <span className={`font-semibold text-sm ${dc('text-slate-200', 'text-slate-700')}`}>{p.name}</span>
                            <span className={`font-bold text-sm tabular-nums ${isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : dc('text-slate-400', 'text-slate-500')}`}>
                              {isPositive ? '+' : ''}₹{Math.abs(bal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Settlements */}
                {settlements.length > 0 && (
                  <div className="glass-card p-7 animate-fade-in-up delay-500">
                    <h2 className="text-lg font-bold mb-5 flex items-center gap-2.5">
                      <div className="section-icon"><ArrowLeftRight size={18} /></div>
                      Settle Up
                    </h2>
                    <div className="space-y-3">
                      {settlements.map((s, i) => (
                        <div key={i} className="settlement-arrow">
                          <span className={`font-semibold text-sm ${dc('text-slate-200', 'text-slate-700')}`}>{getName(s.from)}</span>
                          <div className="flex items-center gap-2 flex-1 justify-center">
                            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent" />
                            <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full whitespace-nowrap">
                              ₹{s.amount.toLocaleString('en-IN')}
                            </span>
                            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent" />
                          </div>
                          <span className={`font-semibold text-sm ${dc('text-slate-200', 'text-slate-700')}`}>{getName(s.to)}</span>
                          <ChevronRight size={16} className="text-indigo-400 flex-shrink-0" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
         TAXES TAB
         ═══════════════════════════════════════════════════ */}
      {activeTab === 'taxes' && (
        <div key="taxes" className="animate-tab-enter">
          {/* Header */}
          <header className="hero-glow relative z-10 pt-16 pb-12 text-center">
            <div className="max-w-3xl mx-auto px-4 animate-fade-in-up">
              <div className="pill-badge mb-4 mx-auto w-fit">
                <Landmark size={12} />
                Indian Income Tax
              </div>
              <h1 className={`text-3xl md:text-5xl font-extrabold tracking-tight mb-4 ${dc('text-white', 'text-slate-900')}`}>
                Smart Tax <span className="gradient-text">Calculator.</span>
              </h1>
              <p className={`text-base max-w-xl mx-auto leading-relaxed ${dc('text-slate-400', 'text-slate-500')}`}>
                Compare Old vs New tax regimes side by side — FY 2024-25. See which saves you more instantly.
              </p>
            </div>
          </header>

          <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

              {/* LEFT: Income & Deductions */}
              <div className="lg:col-span-5 space-y-6">

                {/* Gross Income */}
                <div className="glass-card p-7 animate-fade-in-up delay-100">
                  <h2 className="text-lg font-bold mb-5 flex items-center gap-2.5">
                    <div className="section-icon"><CircleDollarSign size={18} /></div>
                    Annual Income
                  </h2>
                  <div>
                    <label className={`block text-sm font-semibold mb-2.5 ${dc('text-slate-300', 'text-slate-600')}`}>Gross Annual Income</label>
                    <div className="relative">
                      <span className={`absolute left-4 top-1/2 -translate-y-1/2 font-semibold ${dc('text-slate-500', 'text-slate-400')}`}>₹</span>
                      <input type="number" value={taxGross} onChange={e => setTaxGross(Number(e.target.value))} className="input-field pl-9" placeholder="e.g. 1000000" />
                    </div>
                    <p className={`text-xs mt-2.5 ml-1 ${dc('text-slate-500', 'text-slate-400')}`}>
                      Total income before any deductions.
                    </p>
                  </div>
                </div>

                {/* Deductions (Old Regime) */}
                <div className="glass-card p-7 animate-fade-in-up delay-200">
                  <h2 className="text-lg font-bold mb-2 flex items-center gap-2.5">
                    <div className="section-icon"><PiggyBank size={18} /></div>
                    Deductions
                  </h2>
                  <p className={`text-xs mb-5 ${dc('text-slate-500', 'text-slate-400')}`}>
                    For Old Regime only. Standard deduction (₹50,000) is auto-applied.
                  </p>
                  <div className="space-y-4">
                    <div className="deduction-input-group">
                      <label>Section 80C (max ₹1,50,000)</label>
                      <div className="relative">
                        <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold ${dc('text-slate-500', 'text-slate-400')}`}>₹</span>
                        <input type="number" value={ded80c} onChange={e => setDed80c(Number(e.target.value))} className="input-field pl-8" />
                      </div>
                    </div>
                    <div className="deduction-input-group">
                      <label>Section 80D – Health Insurance (max ₹50,000)</label>
                      <div className="relative">
                        <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold ${dc('text-slate-500', 'text-slate-400')}`}>₹</span>
                        <input type="number" value={ded80d} onChange={e => setDed80d(Number(e.target.value))} className="input-field pl-8" />
                      </div>
                    </div>
                    <div className="deduction-input-group">
                      <label>HRA Exemption</label>
                      <div className="relative">
                        <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold ${dc('text-slate-500', 'text-slate-400')}`}>₹</span>
                        <input type="number" value={dedHra} onChange={e => setDedHra(Number(e.target.value))} className="input-field pl-8" />
                      </div>
                    </div>
                    <div className="deduction-input-group">
                      <label>Other Deductions (80E, 80G, etc.)</label>
                      <div className="relative">
                        <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold ${dc('text-slate-500', 'text-slate-400')}`}>₹</span>
                        <input type="number" value={dedOther} onChange={e => setDedOther(Number(e.target.value))} className="input-field pl-8" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT: Tax Comparison */}
              <div className="lg:col-span-7 space-y-6">

                {/* Recommendation Badge */}
                <div className={`health-card animate-fade-in-up delay-200 ${betterRegime ? 'health-good' : ''}`}>
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-green-500/15 text-green-400">
                      <ShieldCheck size={22} />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-green-400">
                        {betterRegime === 'new' ? 'New Regime' : 'Old Regime'} is Better for You!
                      </h3>
                      <p className="text-xs mt-1.5 leading-relaxed text-green-300/70">
                        You save ₹{fmt(Math.round(taxSavings))} by choosing the {betterRegime} regime.
                        {betterRegime === 'old' ? ' Your deductions are making a significant difference.' : ' Fewer deductions make the new regime more beneficial.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Side-by-side Comparison */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                  {/* Old Regime */}
                  <div className={`tax-regime-card animate-fade-in-up delay-300 ${betterRegime === 'old' ? 'recommended' : ''}`}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className={`font-bold text-sm ${dc('text-slate-200', 'text-slate-700')}`}>Old Regime</h3>
                      {betterRegime === 'old' && <span className="tax-badge tax-badge-green">Recommended</span>}
                    </div>
                    <div className="space-y-1 mb-4">
                      <div className="tax-summary-item">
                        <span className={`${dc('text-slate-400', 'text-slate-500')}`}>Gross Income</span>
                        <span className={`font-semibold tabular-nums ${dc('text-slate-200', 'text-slate-700')}`}>₹{fmt(taxGross)}</span>
                      </div>
                      <div className="tax-summary-item">
                        <span className={`${dc('text-slate-400', 'text-slate-500')}`}>Deductions</span>
                        <span className="font-semibold text-green-400 tabular-nums">-₹{fmt(oldTax.deductions)}</span>
                      </div>
                      <div className="tax-summary-item">
                        <span className={`${dc('text-slate-400', 'text-slate-500')}`}>Taxable Income</span>
                        <span className={`font-semibold tabular-nums ${dc('text-slate-200', 'text-slate-700')}`}>₹{fmt(oldTax.taxable)}</span>
                      </div>
                      <div className="tax-summary-item">
                        <span className={`${dc('text-slate-400', 'text-slate-500')}`}>Income Tax</span>
                        <span className={`font-semibold tabular-nums ${dc('text-slate-200', 'text-slate-700')}`}>₹{fmt(Math.round(oldTax.tax))}</span>
                      </div>
                      <div className="tax-summary-item">
                        <span className={`${dc('text-slate-400', 'text-slate-500')}`}>Cess (4%)</span>
                        <span className={`font-semibold tabular-nums ${dc('text-slate-200', 'text-slate-700')}`}>₹{fmt(Math.round(oldTax.cess))}</span>
                      </div>
                    </div>
                    <div className={`flex justify-between items-center pt-3 border-t ${dc('border-white/10', 'border-black/5')}`}>
                      <span className={`font-bold text-sm ${dc('text-slate-200', 'text-slate-700')}`}>Total Tax</span>
                      <span className="font-extrabold text-lg text-amber-400 tabular-nums">₹{fmt(Math.round(oldTax.total))}</span>
                    </div>
                    <p className={`text-xs mt-2 ${dc('text-slate-500', 'text-slate-400')}`}>
                      Effective rate: {taxGross > 0 ? ((oldTax.total / taxGross) * 100).toFixed(1) : 0}%
                    </p>
                  </div>

                  {/* New Regime */}
                  <div className={`tax-regime-card animate-fade-in-up delay-400 ${betterRegime === 'new' ? 'recommended' : ''}`}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className={`font-bold text-sm ${dc('text-slate-200', 'text-slate-700')}`}>New Regime</h3>
                      {betterRegime === 'new' && <span className="tax-badge tax-badge-green">Recommended</span>}
                    </div>
                    <div className="space-y-1 mb-4">
                      <div className="tax-summary-item">
                        <span className={`${dc('text-slate-400', 'text-slate-500')}`}>Gross Income</span>
                        <span className={`font-semibold tabular-nums ${dc('text-slate-200', 'text-slate-700')}`}>₹{fmt(taxGross)}</span>
                      </div>
                      <div className="tax-summary-item">
                        <span className={`${dc('text-slate-400', 'text-slate-500')}`}>Std. Deduction</span>
                        <span className="font-semibold text-green-400 tabular-nums">-₹{fmt(newTax.deductions)}</span>
                      </div>
                      <div className="tax-summary-item">
                        <span className={`${dc('text-slate-400', 'text-slate-500')}`}>Taxable Income</span>
                        <span className={`font-semibold tabular-nums ${dc('text-slate-200', 'text-slate-700')}`}>₹{fmt(newTax.taxable)}</span>
                      </div>
                      <div className="tax-summary-item">
                        <span className={`${dc('text-slate-400', 'text-slate-500')}`}>Income Tax</span>
                        <span className={`font-semibold tabular-nums ${dc('text-slate-200', 'text-slate-700')}`}>₹{fmt(Math.round(newTax.tax))}</span>
                      </div>
                      <div className="tax-summary-item">
                        <span className={`${dc('text-slate-400', 'text-slate-500')}`}>Cess (4%)</span>
                        <span className={`font-semibold tabular-nums ${dc('text-slate-200', 'text-slate-700')}`}>₹{fmt(Math.round(newTax.cess))}</span>
                      </div>
                    </div>
                    <div className={`flex justify-between items-center pt-3 border-t ${dc('border-white/10', 'border-black/5')}`}>
                      <span className={`font-bold text-sm ${dc('text-slate-200', 'text-slate-700')}`}>Total Tax</span>
                      <span className="font-extrabold text-lg text-amber-400 tabular-nums">₹{fmt(Math.round(newTax.total))}</span>
                    </div>
                    <p className={`text-xs mt-2 ${dc('text-slate-500', 'text-slate-400')}`}>
                      Effective rate: {taxGross > 0 ? ((newTax.total / taxGross) * 100).toFixed(1) : 0}%
                    </p>
                  </div>
                </div>

                {/* Tax Slabs Reference */}
                <div className="glass-card p-7 animate-fade-in-up delay-500">
                  <h2 className="text-lg font-bold mb-5 flex items-center gap-2.5">
                    <div className="section-icon"><BadgePercent size={18} /></div>
                    Tax Slab Reference (FY 2024-25)
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Old Slabs */}
                    <div>
                      <h4 className={`text-xs font-bold uppercase tracking-wider mb-3 ${dc('text-slate-400', 'text-slate-500')}`}>Old Regime</h4>
                      <div className="space-y-0.5">
                        {[
                          { range: '₹0 – ₹2.5L', rate: 'Nil' },
                          { range: '₹2.5L – ₹5L', rate: '5%' },
                          { range: '₹5L – ₹10L', rate: '20%' },
                          { range: 'Above ₹10L', rate: '30%' },
                        ].map(s => (
                          <div key={s.range} className="tax-slab-row">
                            <span className={dc('text-slate-300', 'text-slate-600')}>{s.range}</span>
                            <span className={`font-semibold ${dc('text-slate-200', 'text-slate-700')}`}>{s.rate}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* New Slabs */}
                    <div>
                      <h4 className={`text-xs font-bold uppercase tracking-wider mb-3 ${dc('text-slate-400', 'text-slate-500')}`}>New Regime</h4>
                      <div className="space-y-0.5">
                        {[
                          { range: '₹0 – ₹3L', rate: 'Nil' },
                          { range: '₹3L – ₹7L', rate: '5%' },
                          { range: '₹7L – ₹10L', rate: '10%' },
                          { range: '₹10L – ₹12L', rate: '15%' },
                          { range: '₹12L – ₹15L', rate: '20%' },
                          { range: 'Above ₹15L', rate: '30%' },
                        ].map(s => (
                          <div key={s.range} className="tax-slab-row">
                            <span className={dc('text-slate-300', 'text-slate-600')}>{s.range}</span>
                            <span className={`font-semibold ${dc('text-slate-200', 'text-slate-700')}`}>{s.rate}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <p className={`text-xs mt-4 ${dc('text-slate-500', 'text-slate-400')}`}>
                    * 4% Health & Education Cess applies on total tax. Rebate u/s 87A applies for taxable income up to ₹5L (old) / ₹7L (new).
                  </p>
                </div>

                {/* Monthly Breakdown */}
                <div className="glass-card p-7 animate-fade-in-up delay-600">
                  <h2 className="text-lg font-bold mb-5 flex items-center gap-2.5">
                    <div className="section-icon"><Banknote size={18} /></div>
                    Monthly Take-Home Estimate
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className={`p-4 rounded-xl border ${dc('border-white/5 bg-white/[0.02]', 'border-black/5 bg-black/[0.02]')}`}>
                      <p className={`text-xs font-semibold mb-1 ${dc('text-slate-400', 'text-slate-500')}`}>Old Regime</p>
                      <p className={`text-2xl font-extrabold tabular-nums ${dc('text-white', 'text-slate-900')}`}>
                        ₹{fmt(Math.round((taxGross - oldTax.total) / 12))}
                      </p>
                      <p className={`text-xs mt-1 ${dc('text-slate-500', 'text-slate-400')}`}>per month after tax</p>
                    </div>
                    <div className={`p-4 rounded-xl border ${dc('border-white/5 bg-white/[0.02]', 'border-black/5 bg-black/[0.02]')}`}>
                      <p className={`text-xs font-semibold mb-1 ${dc('text-slate-400', 'text-slate-500')}`}>New Regime</p>
                      <p className={`text-2xl font-extrabold tabular-nums ${dc('text-white', 'text-slate-900')}`}>
                        ₹{fmt(Math.round((taxGross - newTax.total) / 12))}
                      </p>
                      <p className={`text-xs mt-1 ${dc('text-slate-500', 'text-slate-400')}`}>per month after tax</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      )}

      {/* ═══════ FOOTER ═══════ */}
      <footer className="relative z-10 mt-16 pb-8">
        <div className="footer-line max-w-4xl mx-auto mb-8" />
        <div className="max-w-7xl mx-auto px-4 flex flex-col items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="bg-gradient-to-br from-indigo-500 to-cyan-500 p-1.5 rounded-lg text-white">
              <Wallet size={16} />
            </div>
            <p className={`font-semibold text-sm ${dc('text-slate-300', 'text-slate-600')}`}>
              Fin<span className="gradient-text">Guide</span>
            </p>
          </div>
          <p className={`text-xs ${dc('text-slate-600', 'text-slate-400')}`}>
            Personal Budget Planner · Built with React · {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
}
