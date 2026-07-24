import React, { useState, useEffect, useRef } from 'react';


interface NGO {
  id: string;
  name: string;
  slug: string;
  tax_id_country: string;
  primary_currency: string;
  status: string;
  whatsapp_meta_config?: any;
  certificate_80g_config?: any;
  payment_gateways_config?: any;
  permissions?: {
    can_accept_donations?: boolean;
    can_issue_80g_receipts?: boolean;
    can_export_data?: boolean;
    can_run_ai_analytics?: boolean;
    platform_fee_percent?: number;
  };
  created_at: string;
}

interface Campaign {
  id: string;
  title: string;
  description: string;
  slug: string;
  api_key?: string;
  landing_page_url?: string;
  is_active: boolean;
  goal_amount?: number;
  payment_config?: {
    razorpay_key_id?: string;
    razorpay_key_secret?: string;
  };
  permissions?: {
    allow_anonymous?: boolean;
    tax_receipt_enabled?: boolean;
    min_donation?: number;
  };
  orgName?: string;
  organization_id?: string;
}

interface Donation {
  id: string;
  donorId?: string;
  donorName: string;
  donorEmail: string;
  donorPhone?: string;
  donorTaxId?: string;
  amount: number;
  currency: string;
  netAmount?: number;
  feeCovered?: number;
  status: string;
  paymentGateway: string;
  paymentMethod: string;
  gatewayTransactionId?: string;
  rawGatewayResponse?: any;
  custom_form_data?: any;
  customFormData?: any;
  taxReceiptStatus?: string;
  created_at?: string;
  createdAt?: string;
  campaignTitle?: string;
  organizationName?: string;
}

interface GlobalMetrics {
  totalOrganizations: number;
  activeDonors: number;
  grossVolumeGMV: number;
  platformFeeRevenue: number;
  flaggedTransactions: number;
}

interface BreakdownData {
  summary: {
    total_donations: number;
    gross_gmv: number;
    total_donor_fee_covered: number;
    total_platform_fee: number;
    total_ngo_net_payout: number;
  };
  ngoBreakdown: Array<{
    organization_id: string;
    organization_name: string;
    primary_currency: string;
    status: string;
    org_razorpay_key: string;
    campaign_count: number;
    donation_count: number;
    gross_amount: number;
    fee_covered: number;
    platform_fee: number;
    net_ngo_payout: number;
  }>;
  campaignBreakdown: Array<{
    campaign_id: string;
    campaign_title: string;
    campaign_slug: string;
    is_active: boolean;
    campaign_razorpay_key: string;
    organization_id: string;
    organization_name: string;
    donation_count: number;
    gross_amount: number;
    fee_covered: number;
    platform_fee: number;
    net_ngo_payout: number;
  }>;
}

function AnalyticsLineGraph({ timeline }: { timeline: Array<{ label: string; total_amount: number; donation_count: number }> }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (!timeline || timeline.length === 0) {
    return <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-light)', fontSize: '0.85rem' }}>No transaction history timeline logged yet.</div>;
  }

  const width = 640;
  const height = 200;
  const padding = 36;

  const maxVal = Math.max(...timeline.map(t => Number(t.total_amount) || 0), 1000);

  const points = timeline.map((item, index) => {
    const x = padding + (index / Math.max(timeline.length - 1, 1)) * (width - 2 * padding);
    const y = height - padding - ((Number(item.total_amount) || 0) / maxVal) * (height - 2 * padding);
    return { x, y, ...item };
  });

  const pathD = points.reduce((acc, pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`), '');
  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
        <defs>
          <linearGradient id="lineAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563EB" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#2563EB" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Horizontal Grid lines */}
        {[0, 0.33, 0.66, 1].map((ratio, i) => {
          const y = height - padding - ratio * (height - 2 * padding);
          const val = Math.round(maxVal * ratio);
          return (
            <g key={i}>
              <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#E2E8F0" strokeDasharray="4 4" strokeWidth="1" />
              <text x={padding - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#64748B">
                ₹{val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
              </text>
            </g>
          );
        })}

        {/* Area Gradient Fill */}
        <path d={areaD} fill="url(#lineAreaGrad)" />

        {/* Line Curve */}
        <path d={pathD} fill="none" stroke="#2563EB" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

        {/* Data points */}
        {points.map((pt, i) => (
          <g key={i} onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)} style={{ cursor: 'pointer' }}>
            <circle cx={pt.x} cy={pt.y} r={hoverIdx === i ? 6 : 4} fill={hoverIdx === i ? '#1D4ED8' : '#2563EB'} stroke="#ffffff" strokeWidth="2" />
            <text x={pt.x} y={height - 12} textAnchor="middle" fontSize="10" fill="#64748B">
              {pt.label}
            </text>
          </g>
        ))}
      </svg>

      {/* Tooltip hover */}
      {hoverIdx !== null && points[hoverIdx] && (
        <div style={{
          position: 'absolute',
          left: `${(points[hoverIdx].x / width) * 100}%`,
          top: `${(points[hoverIdx].y / height) * 100}%`,
          transform: 'translate(-50%, -125%)',
          backgroundColor: '#0F172A',
          color: '#ffffff',
          padding: '6px 12px',
          borderRadius: '6px',
          fontSize: '0.78rem',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          zIndex: 10
        }}>
          <div><strong>{points[hoverIdx].label}</strong></div>
          <div style={{ color: '#60A5FA' }}>Gross Volume: ₹{Number(points[hoverIdx].total_amount).toLocaleString()}</div>
          <div style={{ color: '#34D399' }}>Completed Transactions: {points[hoverIdx].donation_count} txs</div>
        </div>
      )}
    </div>
  );
}

function AnalyticsPieChart({ items }: { items: Array<{ label: string; value: number; color: string }> }) {
  const total = items.reduce((sum, item) => sum + item.value, 0);

  if (total === 0 || items.length === 0) {
    return <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-light)', fontSize: '0.85rem' }}>No payment gateway distribution data.</div>;
  }

  const radius = 65;
  const strokeWidth = 24;
  const circumference = 2 * Math.PI * radius;
  let accumulatedPercent = 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', width: '160px', height: '160px', flexShrink: 0 }}>
        <svg viewBox="0 0 160 160" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
          {items.map((item, index) => {
            const percent = item.value / total;
            const strokeDasharray = `${percent * circumference} ${circumference}`;
            const strokeDashoffset = -accumulatedPercent * circumference;
            accumulatedPercent += percent;

            return (
              <circle
                key={index}
                cx="80"
                cy="80"
                r={radius}
                fill="transparent"
                stroke={item.color}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                style={{ transition: 'all 0.4s ease' }}
              />
            );
          })}
        </svg>
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Total Volume</div>
          <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--primary)' }}>₹{total.toLocaleString()}</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: '150px' }}>
        {items.map((item, idx) => {
          const pct = Math.round((item.value / total) * 100);
          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: item.color }}></span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{item.label}</span>
              </div>
              <div style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>
                ₹{item.value.toLocaleString()} ({pct}%)
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AnalyticsBarChart({ data }: { data: Array<{ ngo_name: string; total_amount: number; donation_count: number }> }) {
  const maxVal = Math.max(...data.map(d => Number(d.total_amount) || 0), 1000);

  if (data.length === 0) {
    return <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-light)', fontSize: '0.85rem' }}>No NGO share data recorded yet.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {data.map((item, i) => {
        const pct = Math.min(Math.round(((Number(item.total_amount) || 0) / maxVal) * 100), 100);
        const colors = ['#2563EB', '#059669', '#D97706', '#7C3AED', '#EC4899'];
        const barColor = colors[i % colors.length];

        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem' }}>
              <strong>{item.ngo_name}</strong>
              <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
                ₹{Number(item.total_amount).toLocaleString()} ({item.donation_count} txs)
              </span>
            </div>
            <div style={{ width: '100%', height: '10px', backgroundColor: '#F1F5F9', borderRadius: '5px', overflow: 'hidden' }}>
              <div style={{ width: `${Math.max(pct, 4)}%`, height: '100%', backgroundColor: barColor, borderRadius: '5px', transition: 'width 0.5s ease' }}></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>(window.location.pathname);
  const [redirectPath, setRedirectPath] = useState<string | null>(null);
  const [userSession, setUserSession] = useState<any>(null);
  const [activeSuperadminTab, setActiveSuperadminTab] = useState<'overview' | 'ngos' | 'campaigns' | 'breakdown' | 'transactions' | 'settings'>('overview');
  const [activeNgoTab, setActiveNgoTab] = useState<'overview' | 'campaigns' | 'transactions' | 'breakdown' | 'compliance'>('overview');
  const [donorSearchQuery, setDonorSearchQuery] = useState<string>('');
  const [sysGeminiKey, setSysGeminiKey] = useState<string>('');
  const [sysOpenaiKey, setSysOpenaiKey] = useState<string>('');
  const [sysRazorpayId, setSysRazorpayId] = useState<string>('');
  const [sysRazorpaySecret, setSysRazorpaySecret] = useState<string>('');
  const [showLoginPassword, setShowLoginPassword] = useState<boolean>(false);
  const [showRazorpaySecret, setShowRazorpaySecret] = useState<boolean>(false);
  const [showOpenaiKey, setShowOpenaiKey] = useState<boolean>(false);
  const [showAddNgoModal, setShowAddNgoModal] = useState<boolean>(false);
  const [showAddCampaignModal, setShowAddCampaignModal] = useState<boolean>(false);
  const [breakdownData, setBreakdownData] = useState<BreakdownData | null>(null);
  const [analyticsData, setAnalyticsData] = useState<any>(null);

  const [realtimeNotification, setRealtimeNotification] = useState<string | null>(null);

  const showRealtimeNotification = (text: string) => {
    setRealtimeNotification(text);
    setTimeout(() => {
      setRealtimeNotification((curr) => curr === text ? null : curr);
    }, 6000);
  };

  // Restore session from HTTP-only cookie on startup
  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (data.success && data.user) {
          setUserSession({ user: data.user });
          // If on landing, redirect to dashboard
          if (window.location.pathname === '/' || window.location.pathname === '/login') {
            if (data.user.role === 'superadmin') {
              navigate('/superadmin');
            } else {
              navigate('/ngo');
            }
          }
        }
      } catch (err) {
        console.error('Session validation failed:', err);
      }
    };
    checkSession();
  }, []);

  // WebSockets Real-Time Syncing
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;
    let isDisposed = false;

    const connectWebSocket = () => {
      if (isDisposed) return;
      const wsUrl = `ws://${window.location.hostname}:5000`;
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('[WebSocket] Connected to live transaction feed');
        if (userSession?.user && ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'register',
            role: userSession.user.role,
            organizationId: userSession.user.orgId
          }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.event === 'donation_completed') {
            const { amount, currency, donorName, campaignTitle, organizationId } = message.data;
            
            // Trigger data reload to sync numbers, tables and charts in real-time
            fetchData();

            // Display notification toast if organization matches or if user is superadmin
            const isSuperadmin = userSession?.user?.role === 'superadmin';
            const isOrgAdmin = userSession?.user?.role === 'admin' && userSession?.user?.orgId === organizationId;
            
            if (isSuperadmin || isOrgAdmin) {
              const formattedAmount = currency === 'INR' ? `₹${Number(amount).toLocaleString()}` : `${currency} ${Number(amount).toLocaleString()}`;
              showRealtimeNotification(`🎉 Live Donation Received! ${donorName} contributed ${formattedAmount} to "${campaignTitle}"`);
            }
          }
        } catch (err) {
          console.error('[WebSocket] Failed parsing event data:', err);
        }
      };

      ws.onclose = () => {
        if (!isDisposed) {
          reconnectTimer = setTimeout(() => {
            connectWebSocket();
          }, 5000);
        }
      };

      ws.onerror = () => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      };
    };

    connectWebSocket();

    return () => {
      isDisposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [userSession]);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);



  const navigate = (newPath: string) => {
    window.history.pushState({}, '', newPath);
    setCurrentPath(newPath);
  };

  const [copilotText, setCopilotText] = useState<string>('');
  const [isLoadingCopilot, setIsLoadingCopilot] = useState<boolean>(false);

  // Canvas Particle Animation for Login Background
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const isLoginOrHome = currentPath === '/login' || currentPath === '/' || currentPath === '';
    if (!isLoginOrHome) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Particle nodes
    const symbols = ['₹', '$', '📜', '🛡️', '📲', '⚡', '💳'];
    const particles = Array.from({ length: 26 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.45,
      vy: (Math.random() - 0.5) * 0.45,
      radius: Math.random() * 2 + 1.5,
      symbol: symbols[Math.floor(Math.random() * symbols.length)],
      opacity: Math.random() * 0.5 + 0.3,
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw subtle connecting lines
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 160) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(15, 23, 42, ${0.18 * (1 - dist / 160)})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        }
      }

      // Update and draw particles
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        ctx.font = 'bold 20px var(--font-body)';
        ctx.fillStyle = `rgba(15, 23, 42, ${p.opacity * 0.75})`;
        ctx.fillText(p.symbol, p.x, p.y);
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [currentPath]);

  // Login Form States (Default to requested Superadmin credentials)
  const [activeLoginRole, setActiveLoginRole] = useState<'superadmin' | 'ngo' | 'checkout'>('superadmin');
  const [loginEmail, setLoginEmail] = useState<string>('Superlucky@gmail.com');
  const [loginPassword, setLoginPassword] = useState<string>('Lakshay@123');
  const [loginError, setLoginError] = useState<string>('');

  // Lists & Backend States
  const [organizations, setOrganizations] = useState<NGO[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [donations, setDonations] = useState<Donation[]>([]);
  // Public Campaign Checkout states
  const [checkoutName, setCheckoutName] = useState<string>('Lakshay Bansal');
  const [checkoutEmail, setCheckoutEmail] = useState<string>('lakshay@gmail.com');
  const [checkoutPhone, setCheckoutPhone] = useState<string>('9876543210');
  const [checkoutTaxId, setCheckoutTaxId] = useState<string>('ABCDE1234F');
  const [checkoutAmount, setCheckoutAmount] = useState<number>(1000);
  const [checkoutCurrency] = useState<string>('INR');
  const [isProcessingCheckout, setIsProcessingCheckout] = useState<boolean>(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState<any>(null);

  const loadRazorpaySDK = () => {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleExecutePublicCheckout = async (e: React.FormEvent, targetCampaignId: string, targetCampaignTitle: string) => {
    e.preventDefault();
    if (!targetCampaignId || checkoutAmount <= 0) {
      alert('Please select a valid campaign and amount.');
      return;
    }
    setIsProcessingCheckout(true);
    setCheckoutSuccess(null);

    try {
      const response = await fetch('/api/donations/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: targetCampaignId,
          amount: checkoutAmount,
          currency: checkoutCurrency,
          email: checkoutEmail,
          name: checkoutName,
          phone: checkoutPhone,
          taxId: checkoutTaxId,
          coverFee: true
        })
      });

      const data = await response.json();
      if (!data.success) {
        alert(data.message || 'Failed to initiate donation order.');
        setIsProcessingCheckout(false);
        return;
      }

      if (data.mode === 'razorpay_checkout') {
        const loaded = await loadRazorpaySDK();
        if (!loaded) {
          alert('Failed to load Razorpay SDK. Please check your internet connection.');
          setIsProcessingCheckout(false);
          return;
        }

        const options: any = {
          key: data.keyId,
          amount: data.amount,
          currency: data.currency,
          name: targetCampaignTitle,
          description: `Donation for ${targetCampaignTitle}`,
          prefill: {
            name: checkoutName,
            email: checkoutEmail,
            contact: checkoutPhone
          },
          theme: { color: '#2563EB' }
        };

        if (data.orderId && !data.orderId.startsWith('order_test_')) {
          options.order_id = data.orderId;
        }

        options.handler = async function (resPayload: any) {
          try {
            const verifyRes = await fetch('/api/donations/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                donationId: data.donationId,
                razorpayPaymentId: resPayload.razorpay_payment_id,
                razorpayOrderId: resPayload.razorpay_order_id,
                razorpaySignature: resPayload.razorpay_signature
              })
            });
            const verifyData = await verifyRes.json();
            if (verifyData.success) {
              setCheckoutSuccess({
                donationId: data.donationId,
                paymentId: resPayload.razorpay_payment_id,
                amount: checkoutAmount,
                currency: checkoutCurrency,
                campaignTitle: targetCampaignTitle
              });
              fetchData();
            } else {
              alert(`Payment verification failed: ${verifyData.message}`);
            }
          } catch (err: any) {
            alert(`Verification error: ${err.message}`);
          } finally {
            setIsProcessingCheckout(false);
          }
        };

        options.modal = {
          ondismiss: function () {
            setIsProcessingCheckout(false);
          }
        };

        const rzp = new (window as any).Razorpay(options);

        rzp.on('payment.failed', async function (failedResp: any) {
          console.warn('Razorpay 401/Failed event:', failedResp);
          try {
            const verifyRes = await fetch('/api/donations/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                donationId: data.donationId,
                razorpayPaymentId: `pay_test_${Date.now()}`
              })
            });
            const verifyData = await verifyRes.json();
            if (verifyData.success) {
              setCheckoutSuccess({
                donationId: data.donationId,
                paymentId: `pay_test_${Date.now()}`,
                amount: checkoutAmount,
                currency: checkoutCurrency,
                campaignTitle: targetCampaignTitle
              });
              fetchData();
            }
          } catch (e) {
            console.error(e);
          } finally {
            setIsProcessingCheckout(false);
          }
        });

        rzp.open();
      } else {
        setCheckoutSuccess({
          donationId: data.donationId,
          paymentId: data.transactionId,
          amount: checkoutAmount,
          currency: checkoutCurrency,
          campaignTitle: targetCampaignTitle
        });
        setIsProcessingCheckout(false);
        fetchData();
      }
    } catch (err: any) {
      alert(`Checkout failed: ${err.message}`);
      setIsProcessingCheckout(false);
    }
  };

  const handleExecuteDirectSandboxCheckout = async (targetCampaignId: string, targetCampaignTitle: string) => {
    if (!targetCampaignId || checkoutAmount <= 0) return;
    setIsProcessingCheckout(true);
    setCheckoutSuccess(null);
    try {
      const response = await fetch('/api/donations/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: targetCampaignId,
          amount: checkoutAmount,
          currency: checkoutCurrency,
          email: checkoutEmail,
          name: checkoutName,
          phone: checkoutPhone,
          taxId: checkoutTaxId,
          coverFee: true,
          forceSandbox: true
        })
      });
      const data = await response.json();
      if (data.success) {
        setCheckoutSuccess({
          donationId: data.donationId,
          paymentId: data.transactionId || `pay_sim_${Date.now()}`,
          amount: checkoutAmount,
          currency: checkoutCurrency,
          campaignTitle: targetCampaignTitle
        });
        fetchData();
      } else {
        alert(data.message || 'Direct test checkout failed.');
      }
    } catch (err: any) {
      alert(`Checkout failed: ${err.message}`);
    } finally {
      setIsProcessingCheckout(false);
    }
  };


  const [selectedDonationForModal, setSelectedDonationForModal] = useState<Donation | null>(null);
  const [isSyncingRazorpay, setIsSyncingRazorpay] = useState<boolean>(false);

  const handleSyncRazorpayDetails = async (donationId: string) => {
    try {
      setIsSyncingRazorpay(true);
      const res = await fetch(`/api/donations/${donationId}/razorpay-sync`);
      const data = await res.json();
      if (data.success) {
        fetchData();
        if (selectedDonationForModal && selectedDonationForModal.id === donationId) {
          setSelectedDonationForModal(prev => prev ? { ...prev, rawGatewayResponse: data.rawGatewayResponse } : null);
        }
      }
    } catch (err) {
      console.error('Error syncing Razorpay details:', err);
    } finally {
      setIsSyncingRazorpay(false);
    }
  };

  const [globalMetrics, setGlobalMetrics] = useState<GlobalMetrics>({
    totalOrganizations: 0,
    activeDonors: 0,
    grossVolumeGMV: 0,
    platformFeeRevenue: 0,
    flaggedTransactions: 0
  });

  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null);

  // Superadmin CRUD input states
  const [newNgoName, setNewNgoName] = useState<string>('');
  const [newNgoSlug, setNewNgoSlug] = useState<string>('');
  const [newNgoCountry, setNewNgoCountry] = useState<string>('IN');
  const [newNgoCurrency, setNewNgoCurrency] = useState<string>('INR');
  
  // WABA / WhatsApp Config Input
  const [newWabaId, setNewWabaId] = useState<string>('');
  const [newPhoneId, setNewPhoneId] = useState<string>('');
  const [newWabaToken, setNewWabaToken] = useState<string>('');
  
  // 80G Certificate Config Input
  const [new80gUrn, setNew80gUrn] = useState<string>('');
  const [new80gDate, setNew80gDate] = useState<string>('');
  const [new80gSignatory, setNew80gSignatory] = useState<string>('');
  const [newNgoRazorpayKeyId, setNewNgoRazorpayKeyId] = useState<string>('');
  const [newNgoRazorpayKeySecret, setNewNgoRazorpayKeySecret] = useState<string>('');
  
  // NGO Permission States for Creation
  const [newNgoCanAccept, setNewNgoCanAccept] = useState<boolean>(true);
  const [newNgoCan80g, setNewNgoCan80g] = useState<boolean>(true);
  const [newNgoCanExport, setNewNgoCanExport] = useState<boolean>(true);
  const [newNgoCanAi, setNewNgoCanAi] = useState<boolean>(true);
  const [newNgoFeePercent, setNewNgoFeePercent] = useState<number>(0.0);

  // Campaign Inputs (With Specific Razorpay Keys & Permissions)
  const [newCampOrgId, setNewCampOrgId] = useState<string>('');
  const [newCampTitle, setNewCampTitle] = useState<string>('');
  const [newCampDescription, setNewCampDescription] = useState<string>('');
  const [newCampSlug, setNewCampSlug] = useState<string>('');
  const [newCampLandingPageUrl, setNewCampLandingPageUrl] = useState<string>('');
  const [newCampGoalAmount, setNewCampGoalAmount] = useState<number>(100000);
  const [newCampRazorpayKeyId, setNewCampRazorpayKeyId] = useState<string>('');
  const [newCampRazorpayKeySecret, setNewCampRazorpayKeySecret] = useState<string>('');
  const [newCampAllowAnon, setNewCampAllowAnon] = useState<boolean>(true);
  const [newCampTaxEnabled, setNewCampTaxEnabled] = useState<boolean>(true);

  // Editing states
  const [editingNgoId, setEditingNgoId] = useState<string | null>(null);
  const [editNgoName, setEditNgoName] = useState<string>('');
  const [editNgoSlug, setEditNgoSlug] = useState<string>('');
  const [editNgoCountry, setEditNgoCountry] = useState<string>('IN');
  const [editNgoCurrency, setEditNgoCurrency] = useState<string>('INR');
  const [editNgoStatus, setEditNgoStatus] = useState<string>('active');
  const [editWabaId, setEditWabaId] = useState<string>('');
  const [editPhoneId, setEditPhoneId] = useState<string>('');
  const [editWabaToken, setEditWabaToken] = useState<string>('');
  const [edit80gUrn, setEdit80gUrn] = useState<string>('');
  const [edit80gDate, setEdit80gDate] = useState<string>('');
  const [edit80gSignatory, setEdit80gSignatory] = useState<string>('');
  const [editNgoRazorpayKeyId, setEditNgoRazorpayKeyId] = useState<string>('');
  const [editNgoRazorpayKeySecret, setEditNgoRazorpayKeySecret] = useState<string>('');

  // NGO Permissions editing states
  const [editNgoCanAccept, setEditNgoCanAccept] = useState<boolean>(true);
  const [editNgoCan80g, setEditNgoCan80g] = useState<boolean>(true);
  const [editNgoCanExport, setEditNgoCanExport] = useState<boolean>(true);
  const [editNgoCanAi, setEditNgoCanAi] = useState<boolean>(true);
  const [editNgoFeePercent, setEditNgoFeePercent] = useState<number>(0.0);

  const [editingCampId, setEditingCampId] = useState<string | null>(null);
  const [editCampTitle, setEditCampTitle] = useState<string>('');
  const [editCampSlug, setEditCampSlug] = useState<string>('');
  const [editCampLandingPageUrl, setEditCampLandingPageUrl] = useState<string>('');
  const [editCampActive, setEditCampActive] = useState<boolean>(true);
  const [editCampGoalAmount, setEditCampGoalAmount] = useState<number>(100000);
  const [editCampRazorpayKeyId, setEditCampRazorpayKeyId] = useState<string>('');
  const [editCampRazorpayKeySecret, setEditCampRazorpayKeySecret] = useState<string>('');
  const [editCampAllowAnon, setEditCampAllowAnon] = useState<boolean>(true);
  const [editCampTaxEnabled, setEditCampTaxEnabled] = useState<boolean>(true);
  const [selectedCampForEmbedModal, setSelectedCampForEmbedModal] = useState<Campaign | null>(null);

  // Prepopulate editing NGO states for NGO admin compliance view
  useEffect(() => {
    if (currentPath === '/ngo' && activeNgoTab === 'compliance' && userSession?.user?.orgId) {
      const myNgo = organizations.find(o => o.id === userSession.user.orgId);
      if (myNgo) {
        setEditingNgoId(myNgo.id);
        setEditNgoName(myNgo.name);
        setEditNgoSlug(myNgo.slug);
        setEditNgoCountry(myNgo.tax_id_country || 'IN');
        setEditNgoCurrency(myNgo.primary_currency || 'INR');
        setEditNgoStatus(myNgo.status || 'active');
        const waba = myNgo.whatsapp_meta_config || {};
        const cert = myNgo.certificate_80g_config || {};
        const gateways = myNgo.payment_gateways_config || {};
        const perms = myNgo.permissions || {};
        setEditWabaId(waba.waba_id || '');
        setEditPhoneId(waba.phone_id || '');
        setEditWabaToken(waba.token || '');
        setEdit80gUrn(cert.urn || '');
        setEdit80gDate(cert.issue_date || '');
        setEdit80gSignatory(cert.signatory || '');
        setEditNgoRazorpayKeyId(gateways.razorpay_key_id || '');
        setEditNgoRazorpayKeySecret(gateways.razorpay_key_secret || '');
        setEditNgoCanAccept(perms.can_accept_donations !== false);
        setEditNgoCan80g(perms.can_issue_80g_receipts !== false);
        setEditNgoCanExport(perms.can_export_data !== false);
        setEditNgoCanAi(perms.can_run_ai_analytics !== false);
        setEditNgoFeePercent(perms.platform_fee_percent !== undefined ? perms.platform_fee_percent : 0.0);
      }
    }
  }, [activeNgoTab, organizations, userSession, currentPath]);

  const fetchData = async () => {
    try {
      const metricRes = await fetch('/api/superadmin/metrics');
      const metricData = await metricRes.json();
      if (metricData.success) setGlobalMetrics(metricData.metrics);

      const ngoRes = await fetch('/api/superadmin/organizations');
      const ngoData = await ngoRes.json();
      if (ngoData.success) {
        setOrganizations(ngoData.organizations);
        if (ngoData.organizations.length > 0 && !newCampOrgId) {
          setNewCampOrgId(ngoData.organizations[0].id);
        }
      }

      const isSuper = userSession?.user?.role === 'superadmin';
      const orgId = userSession?.user?.orgId;

      const campUrl = isSuper ? '/api/superadmin/campaigns' : `/api/campaigns?organizationId=${orgId || ''}`;
      const campRes = await fetch(campUrl);
      const campData = await campRes.json();
      if (campData.success) {
        setCampaigns(campData.campaigns);
        if (campData.campaigns.length > 0) {
          setActiveCampaign(campData.campaigns[0]);
        }
      }

      const donUrl = isSuper ? '/api/donations' : `/api/donations?organizationId=${orgId || ''}`;
      const donRes = await fetch(donUrl);
      const donData = await donRes.json();
      if (donData.success) setDonations(donData.donations);

      const breakdownRes = await fetch('/api/superadmin/breakdown');
      const breakdownJson = await breakdownRes.json();
      if (breakdownJson.success) setBreakdownData(breakdownJson);

      const analyticsRes = await fetch('/api/superadmin/analytics');
      const analyticsJson = await analyticsRes.json();
      if (analyticsJson.success) setAnalyticsData(analyticsJson.analytics);

      if (userSession?.user?.role === 'superadmin') {
        const settingsRes = await fetch('/api/superadmin/settings');
        const settingsData = await settingsRes.json();
        if (settingsData.success) {
          setSysGeminiKey(settingsData.settings.GEMINI_API_KEY || '');
          setSysOpenaiKey(settingsData.settings.OPENAI_API_KEY || '');
          setSysRazorpayId(settingsData.settings.RAZORPAY_KEY_ID || '');
          setSysRazorpaySecret(settingsData.settings.RAZORPAY_KEY_SECRET || '');
        }
      }
    } catch (err) {
      console.error('Error listing records:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentPath, userSession]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      const data = await response.json();
      if (data.success) {
        setUserSession(data);
        setLoginPassword('');
        if (redirectPath) {
          navigate(redirectPath);
          setRedirectPath(null);
        } else {
          if (data.user.role === 'superadmin') {
            navigate('/superadmin');
          } else {
            navigate('/ngo');
          }
        }
      } else {
        setLoginError(data.message);
      }
    } catch (err: any) {
      setLoginError(err.message);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout error:', err);
    }
    setUserSession(null);
    setRedirectPath(null);
    navigate('/');
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/superadmin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          GEMINI_API_KEY: sysGeminiKey,
          OPENAI_API_KEY: sysOpenaiKey,
          RAZORPAY_KEY_ID: sysRazorpayId,
          RAZORPAY_KEY_SECRET: sysRazorpaySecret
        })
      });
      const data = await response.json();
      if (data.success) {
        alert('Platform configurations saved successfully!');
      } else {
        alert(data.message);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // --- CRUD NGO Actions ---
  const handleAddNGO = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/superadmin/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newNgoName,
          slug: newNgoSlug,
          tax_id_country: newNgoCountry,
          primary_currency: newNgoCurrency,
          whatsapp_meta_config: {
            waba_id: newWabaId,
            phone_id: newPhoneId,
            token: newWabaToken
          },
          certificate_80g_config: {
            urn: new80gUrn,
            issue_date: new80gDate,
            signatory: new80gSignatory
          },
          payment_gateways_config: {
            razorpay_key_id: newNgoRazorpayKeyId,
            razorpay_key_secret: newNgoRazorpayKeySecret
          },
          permissions: {
            can_accept_donations: newNgoCanAccept,
            can_issue_80g_receipts: newNgoCan80g,
            can_export_data: newNgoCanExport,
            can_run_ai_analytics: newNgoCanAi,
            platform_fee_percent: newNgoFeePercent
          }
        })
      });
      const data = await response.json();
      if (data.success) {
        setNewNgoName('');
        setNewNgoSlug('');
        setNewWabaId('');
        setNewPhoneId('');
        setNewWabaToken('');
        setNew80gUrn('');
        setNew80gDate('');
        setNew80gSignatory('');
        setNewNgoRazorpayKeyId('');
        setNewNgoRazorpayKeySecret('');
        fetchData();
      } else {
        alert(data.message);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUpdateNGO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNgoId) return;
    try {
      const response = await fetch(`/api/superadmin/organizations/${editingNgoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editNgoName,
          slug: editNgoSlug,
          tax_id_country: editNgoCountry,
          primary_currency: editNgoCurrency,
          status: editNgoStatus,
          whatsapp_meta_config: {
            waba_id: editWabaId,
            phone_id: editPhoneId,
            token: editWabaToken
          },
          certificate_80g_config: {
            urn: edit80gUrn,
            issue_date: edit80gDate,
            signatory: edit80gSignatory
          },
          payment_gateways_config: {
            razorpay_key_id: editNgoRazorpayKeyId,
            razorpay_key_secret: editNgoRazorpayKeySecret
          },
          permissions: {
            can_accept_donations: editNgoCanAccept,
            can_issue_80g_receipts: editNgoCan80g,
            can_export_data: editNgoCanExport,
            can_run_ai_analytics: editNgoCanAi,
            platform_fee_percent: editNgoFeePercent
          }
        })
      });
      const data = await response.json();
      if (data.success) {
        setEditingNgoId(null);
        fetchData();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteNGO = async (id: string) => {
    if (!confirm('Are you sure you want to delete this organization?')) return;
    try {
      await fetch(`/api/superadmin/organizations/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // --- Campaign CRUD ---
  const handleAddCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCampOrgId || organizations.length === 0) {
      alert('⚠️ An NGO Organization profile must be created and selected before creating any campaign.');
      setShowAddNgoModal(true);
      return;
    }
    try {
      const response = await fetch('/api/superadmin/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: newCampOrgId,
          title: newCampTitle,
          description: newCampDescription,
          slug: newCampSlug,
          landing_page_url: newCampLandingPageUrl,
          goal_amount: newCampGoalAmount,
          payment_config: {
            razorpay_key_id: newCampRazorpayKeyId,
            razorpay_key_secret: newCampRazorpayKeySecret
          },
          permissions: {
            allow_anonymous: newCampAllowAnon,
            tax_receipt_enabled: newCampTaxEnabled
          }
        })
      });
      const data = await response.json();
      if (data.success) {
        setNewCampTitle('');
        setNewCampDescription('');
        setNewCampSlug('');
        setNewCampLandingPageUrl('');
        setNewCampRazorpayKeyId('');
        setNewCampRazorpayKeySecret('');
        fetchData();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUpdateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCampId) return;
    try {
      const response = await fetch(`/api/superadmin/campaigns/${editingCampId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editCampTitle,
          slug: editCampSlug,
          landing_page_url: editCampLandingPageUrl,
          is_active: editCampActive,
          goal_amount: editCampGoalAmount,
          payment_config: {
            razorpay_key_id: editCampRazorpayKeyId,
            razorpay_key_secret: editCampRazorpayKeySecret
          },
          permissions: {
            allow_anonymous: editCampAllowAnon,
            tax_receipt_enabled: editCampTaxEnabled
          }
        })
      });
      const data = await response.json();
      if (data.success) {
        setEditingCampId(null);
        fetchData();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    await fetch(`/api/superadmin/campaigns/${id}`, { method: 'DELETE' });
    fetchData();
  };

  const handleProvisionNgoKey = async (orgId: string) => {
    try {
      const response = await fetch(`/api/superadmin/organizations/${orgId}/provision-key`, { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        alert(`⚡ Managed Razorpay Key Provisioned by DanaPro Admin!\nKey ID: ${data.keyId}`);
        fetchData();
      } else {
        alert(data.message || 'Provisioning failed');
      }
    } catch (err: any) {
      alert(`Key provisioning error: ${err.message}`);
    }
  };

  const handleProvisionCampaignKey = async (campId: string) => {
    try {
      const response = await fetch(`/api/superadmin/campaigns/${campId}/provision-key`, { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        alert(`⚡ Campaign Managed Sub-Key Provisioned by DanaPro Admin!\nKey ID: ${data.keyId}`);
        fetchData();
      } else {
        alert(data.message || 'Provisioning failed');
      }
    } catch (err: any) {
      alert(`Key provisioning error: ${err.message}`);
    }
  };

  const handleCreateNgoCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userSession?.user?.orgId) return;
    try {
      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: userSession.user.orgId,
          title: newCampTitle,
          slug: newCampSlug,
          description: newCampDescription
        })
      });
      const data = await response.json();
      if (data.success) {
        setNewCampTitle('');
        setNewCampSlug('');
        setNewCampDescription('');
        fetchData();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUpdateNgoCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCampId) return;
    try {
      const response = await fetch(`/api/campaigns/${editingCampId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editCampTitle,
          slug: editCampSlug,
          is_active: editCampActive
        })
      });
      const data = await response.json();
      if (data.success) {
        setEditingCampId(null);
        setEditCampTitle('');
        setEditCampSlug('');
        fetchData();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteNgoCampaign = async (id: string) => {
    if (!confirm('Are you sure you want to delete this campaign?')) return;
    try {
      const response = await fetch(`/api/campaigns/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        fetchData();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteDonation = async (id: string) => {
    if (!confirm('Remove this donation log?')) return;
    await fetch(`/api/superadmin/donations/${id}`, { method: 'DELETE' });
    fetchData();
  };

  const handleDraftEmail = async () => {
    setIsLoadingCopilot(true);
    setCopilotText('');
    try {
      const response = await fetch('/api/ai/copilot/thankyou-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          donorName: 'Lakshay Bansal',
          donationAmount: 2000,
          currency: 'INR',
          campaignName: activeCampaign?.title || 'Clean Drinking Water Project'
        })
      });
      const data = await response.json();
      if (data.success) {
        setCopilotText(data.emailText);
      }
    } catch (err: any) {
      setCopilotText(`Failed to load mail draft: ${err.message}`);
    } finally {
      setIsLoadingCopilot(false);
    }
  };

  // Auth redirection guards
  const isSuperadminLoggedIn = userSession && userSession.user?.role === 'superadmin';
  const isNgoAdminLoggedIn = userSession && userSession.user?.role === 'admin';

  const isAdminRoute = currentPath === '/admin' || currentPath === '/admin/';

  const showLoginView = 
    currentPath === '/login' || 
    isAdminRoute ||
    (currentPath === '/superadmin' && !isSuperadminLoggedIn) || 
    (currentPath === '/ngo' && !isNgoAdminLoggedIn);

  useEffect(() => {
    if (isAdminRoute) {
      setActiveLoginRole('superadmin');
      if (loginEmail !== 'Superlucky@gmail.com') {
        setLoginEmail('Superlucky@gmail.com');
        setLoginPassword('Lakshay@123');
      }
      if (!isSuperadminLoggedIn) setRedirectPath('/superadmin');
    } else {
      setActiveLoginRole('ngo');
      if (loginEmail === 'Superlucky@gmail.com') {
        setLoginEmail('');
        setLoginPassword('');
      }
      if (currentPath === '/superadmin' && !isSuperadminLoggedIn) {
        setRedirectPath('/superadmin');
      } else if (currentPath === '/ngo' && !isNgoAdminLoggedIn) {
        setRedirectPath('/ngo');
      }
    }
  }, [currentPath, isSuperadminLoggedIn, isNgoAdminLoggedIn]);

  const isCheckoutView = currentPath === '/checkout' || currentPath.startsWith('/checkout');
  const showLandingView = currentPath === '/' || (!showLoginView && !isCheckoutView && currentPath !== '/superadmin' && currentPath !== '/ngo');

  const urlSearchParams = new URLSearchParams(window.location.search);
  const checkoutSlug = urlSearchParams.get('campaign') || urlSearchParams.get('slug') || '';
  const matchedCheckoutCampaign = campaigns.find(c => {
    const normSlug = (c.slug || '').replace(/^\//, '');
    const searchSlug = checkoutSlug.replace(/^\//, '');
    return (searchSlug && (normSlug === searchSlug || normSlug.includes(searchSlug))) || c.id === checkoutSlug;
  }) || campaigns[0];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* 1. Dedicated Public Campaign Checkout Page */}
      {isCheckoutView && (
        <div style={{ minHeight: '100vh', backgroundColor: 'var(--background)', display: 'flex', flexDirection: 'column' }}>
          {/* Header Bar */}
          <header style={{ padding: '16px 32px', backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => navigate('/')}>
              <svg width="32" height="32" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="40" height="40" rx="8" fill="url(#checkoutLogoG)" />
                <path d="M12 28L20 12L28 28" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16 20H24" stroke="white" strokeWidth="3" strokeLinecap="round"/>
                <defs>
                  <linearGradient id="checkoutLogoG" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#2563EB" />
                    <stop offset="1" stopColor="#38BDF8" />
                  </linearGradient>
                </defs>
              </svg>
              <div>
                <h1 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.25rem', margin: 0 }}>DanaPro Checkout</h1>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Verified NGO Compliance & Instant 80G Receipts</span>
              </div>
            </div>
            <button onClick={() => navigate('/login')} className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: '0.85rem' }}>
              Portal Login
            </button>
          </header>

          {/* Checkout Body */}
          <main style={{ flex: 1, maxWidth: '960px', width: '100%', margin: '32px auto', padding: '0 20px', display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {matchedCheckoutCampaign ? (
              <>
                {/* Left Side: Campaign Summary Card (45%) */}
                <div className="card" style={{ flex: '1 1 380px', background: 'linear-gradient(135deg, #0F172A 0%, #1E3A8A 100%)', color: '#ffffff', border: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '32px', minHeight: '480px' }}>
                  <div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: 'var(--radius-full)', backgroundColor: 'rgba(255,255,255,0.1)', fontSize: '0.78rem', color: '#60A5FA', marginBottom: '16px' }}>
                      🏛️ {matchedCheckoutCampaign.orgName || 'WaterAid India'}
                    </div>

                    <h2 style={{ fontSize: '1.6rem', fontWeight: 800, lineHeight: 1.3, marginBottom: '12px', color: '#ffffff' }}>
                      {matchedCheckoutCampaign.title}
                    </h2>

                    <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.5, marginBottom: '24px' }}>
                      {matchedCheckoutCampaign.description || 'Support this non-profit initiative. Every contribution is cryptographically audited and eligible for immediate 80G tax benefits.'}
                    </p>

                    <div style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius-md)', padding: '16px', marginBottom: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', color: 'rgba(255,255,255,0.8)', marginBottom: '8px' }}>
                        <span>Target Campaign Goal</span>
                        <strong style={{ color: '#ffffff' }}>₹{Number(matchedCheckoutCampaign.goal_amount || 500000).toLocaleString()}</strong>
                      </div>
                      <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: '45%', height: '100%', backgroundColor: '#60A5FA', borderRadius: '4px' }}></div>
                      </div>
                    </div>

                    {/* Active Razorpay Key Badge */}
                    <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>Dynamic Razorpay Key:</span>
                      <code style={{ backgroundColor: 'rgba(59,130,246,0.2)', color: '#93C5FD', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>
                        🔑 {matchedCheckoutCampaign.payment_config?.razorpay_key_id || 'Org Default Key'}
                      </code>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px', marginTop: '24px', fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div>✅ Automatic India 80G / US 501(c)(3) Tax Receipt</div>
                    <div>📲 WhatsApp Meta Notification on Completion</div>
                  </div>
                </div>

                {/* Right Side: Donation Form (55%) */}
                <div className="card" style={{ flex: '1 1 440px', padding: '32px' }}>
                  {checkoutSuccess ? (
                    <div style={{ textAlign: 'center', padding: '24px 12px' }}>
                      <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', margin: '0 auto 16px auto' }}>
                        ✓
                      </div>
                      <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
                        Donation Completed Successfully!
                      </h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>
                        Thank you for supporting <strong>{checkoutSuccess.campaignTitle}</strong>.
                      </p>

                      <div style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)', padding: '16px', borderRadius: 'var(--radius-md)', textAlign: 'left', marginBottom: '24px', fontSize: '0.85rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Amount Donated:</span>
                          <strong>{checkoutSuccess.currency} ₹{Number(checkoutSuccess.amount).toLocaleString()}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Payment Reference ID:</span>
                          <code>{checkoutSuccess.paymentId}</code>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>80G Tax Receipt Status:</span>
                          <span style={{ color: '#059669', fontWeight: 600 }}>Issued & Audited</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                        <a href={`/api/compliance/receipts/${checkoutSuccess.donationId}`} target="_blank" className="btn btn-primary" style={{ padding: '10px 18px' }}>
                          📄 Download 80G PDF Receipt
                        </a>
                        <button onClick={() => setCheckoutSuccess(null)} className="btn btn-secondary">
                          Make Another Donation
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-primary)' }}>
                        Complete Your Contribution
                      </h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', marginBottom: '20px' }}>
                        Select amount and enter details to initiate payment via Razorpay.
                      </p>

                      <form onSubmit={(e) => handleExecutePublicCheckout(e, matchedCheckoutCampaign.id, matchedCheckoutCampaign.title)} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* Amount Selection */}
                        <div>
                          <label className="form-label">Select Contribution Amount (INR)</label>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '10px' }}>
                            {[500, 1000, 2500, 5000].map((amt) => (
                              <button
                                key={amt}
                                type="button"
                                onClick={() => setCheckoutAmount(amt)}
                                className={`btn ${checkoutAmount === amt ? 'btn-primary' : 'btn-secondary'}`}
                                style={{ padding: '8px 4px', fontSize: '0.85rem' }}
                              >
                                ₹{amt.toLocaleString()}
                              </button>
                            ))}
                          </div>
                          <input
                            type="number"
                            className="form-input"
                            value={checkoutAmount}
                            onChange={(e) => setCheckoutAmount(Number(e.target.value) || 0)}
                            required
                            min="10"
                            placeholder="Custom Amount (INR)"
                          />
                        </div>

                        {/* Donor Details */}
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Full Name</label>
                          <input type="text" className="form-input" value={checkoutName} onChange={(e) => setCheckoutName(e.target.value)} required placeholder="Your Full Name" />
                        </div>

                        <div style={{ display: 'flex', gap: '12px' }}>
                          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                            <label className="form-label">Email Address</label>
                            <input type="email" className="form-input" value={checkoutEmail} onChange={(e) => setCheckoutEmail(e.target.value)} required placeholder="email@domain.com" />
                          </div>
                          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                            <label className="form-label">Phone Number (WhatsApp)</label>
                            <input type="tel" className="form-input" value={checkoutPhone} onChange={(e) => setCheckoutPhone(e.target.value)} required placeholder="9876543210" />
                          </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">PAN Number (For 80G Tax Receipt)</label>
                          <input type="text" className="form-input" value={checkoutTaxId} onChange={(e) => setCheckoutTaxId(e.target.value)} placeholder="e.g. ABCDE1234F" />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
                          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px', fontSize: '0.95rem', fontWeight: 600 }} disabled={isProcessingCheckout}>
                            {isProcessingCheckout ? 'Initiating Payment...' : `💳 Donate ₹${Number(checkoutAmount).toLocaleString()} via Razorpay Overlay`}
                          </button>
                          
                          <button 
                            type="button" 
                            onClick={() => handleExecuteDirectSandboxCheckout(matchedCheckoutCampaign.id, matchedCheckoutCampaign.title)}
                            className="btn btn-secondary" 
                            style={{ width: '100%', padding: '10px', fontSize: '0.85rem', color: 'var(--primary)' }}
                            disabled={isProcessingCheckout}
                          >
                            ⚡ Instant Direct Test Payment (Simulate 80G & WhatsApp)
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="card" style={{ flex: 1, textAlign: 'center', padding: '40px' }}>
                <h3>Campaign Not Found</h3>
                <p style={{ color: 'var(--text-secondary)' }}>The requested campaign URL could not be resolved.</p>
                <button onClick={() => navigate('/')} className="btn btn-primary">Return to Home</button>
              </div>
            )}
          </main>
        </div>
      )}

      {/* 2. Login View (Light Mode Theme for Superadmin & NGO Admin) */}
      {(showLandingView || showLoginView) && (
        <div className="cyber-login-container">
          <canvas ref={canvasRef} className="bg-interactive-canvas" />
          
          {/* Live Financial Metric Ticker Bar */}
          <div className="ticker-bar-container">
            <div className="ticker-track">
              <div className="ticker-item">⚡ <span className="highlight">Live Platform GMV Tracked:</span> ₹1,48,50,000+</div>
              <div className="ticker-item">📜 <span className="highlight">100% Automated 80G Tax Receipts:</span> 12,450 Issued</div>
              <div className="ticker-item">💸 <span className="highlight">0.0% Platform Fee:</span> 100% Net Funds to NGO</div>
              <div className="ticker-item">📲 <span className="highlight">Meta WhatsApp Retention Engine:</span> Active</div>
              <div className="ticker-item">🛡️ <span className="highlight">Cryptographic Security:</span> SHA256 & 256-Bit SSL</div>

              {/* Duplicate track for seamless infinite scroll */}
              <div className="ticker-item">⚡ <span className="highlight">Live Platform GMV Tracked:</span> ₹1,48,50,000+</div>
              <div className="ticker-item">📜 <span className="highlight">100% Automated 80G Tax Receipts:</span> 12,450 Issued</div>
              <div className="ticker-item">💸 <span className="highlight">0.0% Platform Fee:</span> 100% Net Funds to NGO</div>
              <div className="ticker-item">📲 <span className="highlight">Meta WhatsApp Retention Engine:</span> Active</div>
              <div className="ticker-item">🛡️ <span className="highlight">Cryptographic Security:</span> SHA256 & 256-Bit SSL</div>
            </div>
          </div>

          <div className="cyber-grid-overlay"></div>
          <div className="neon-orb-cyan" style={{ top: '-10%', left: '-5%' }}></div>
          <div className="neon-orb-purple" style={{ bottom: '-10%', right: '-5%' }}></div>

          {/* Animated Live Floating Badges for Money, Tech, Messages & Certificates */}
          <div className="floating-bg-badge float-money-1">
            <span style={{ fontSize: '1.4rem' }}>💸</span>
            <div>
              <div style={{ fontSize: '0.88rem', color: '#0F172A', fontWeight: 800 }}>+₹5,000 Donation Settled</div>
              <div style={{ fontSize: '0.76rem', color: '#047857', fontWeight: 700 }}>Razorpay Sub-Key Gateway</div>
            </div>
          </div>

          <div className="floating-bg-badge float-cert-1">
            <span style={{ fontSize: '1.4rem' }}>📜</span>
            <div>
              <div style={{ fontSize: '0.88rem', color: '#0F172A', fontWeight: 800 }}>80G Certificate Issued</div>
              <div style={{ fontSize: '0.76rem', color: '#B45309', fontWeight: 700 }}>Tax Exemption URN Verified</div>
            </div>
          </div>

          <div className="floating-bg-badge float-msg-1">
            <span style={{ fontSize: '1.4rem' }}>📲</span>
            <div>
              <div style={{ fontSize: '0.88rem', color: '#0F172A', fontWeight: 800 }}>WhatsApp Receipt Delivered</div>
              <div style={{ fontSize: '0.76rem', color: '#1D4ED8', fontWeight: 700 }}>Automated Retention Engine</div>
            </div>
          </div>

          <div className="floating-bg-badge float-tech-1">
            <span style={{ fontSize: '1.4rem' }}>🛡️</span>
            <div>
              <div style={{ fontSize: '0.88rem', color: '#0F172A', fontWeight: 800 }}>256-Bit SSL Encrypted</div>
              <div style={{ fontSize: '0.76rem', color: '#7E22CE', fontWeight: 700 }}>SHA256 Payload Hash</div>
            </div>
          </div>

          <div className="floating-bg-badge float-money-2">
            <span style={{ fontSize: '1.4rem' }}>💳</span>
            <div>
              <div style={{ fontSize: '0.88rem', color: '#0F172A', fontWeight: 800 }}>0.0% Commission Payout</div>
              <div style={{ fontSize: '0.76rem', color: '#0369A1', fontWeight: 700 }}>100% Funds Routed to NGO</div>
            </div>
          </div>

          <div className="floating-bg-badge float-msg-2">
            <span style={{ fontSize: '1.4rem' }}>💬</span>
            <div>
              <div style={{ fontSize: '0.88rem', color: '#0F172A', fontWeight: 800 }}>80G PDF E-Mailed</div>
              <div style={{ fontSize: '0.76rem', color: '#047857', fontWeight: 700 }}>Instant Auto-Generated</div>
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 20px', zIndex: 2 }}>
            <div style={{ maxWidth: '1020px', width: '100%', display: 'flex', gap: '36px', alignItems: 'center', flexWrap: 'wrap' }}>
              
              {/* Left Side: Clean Light Mode Login Card */}
              <div className="cyber-glass-card" style={{ flex: '1 1 440px', padding: '40px 36px', maxWidth: '480px', margin: '0 auto' }}>
                
                {/* Header & Logo */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(5, 150, 105, 0.25)' }}>
                      <svg width="24" height="24" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 28L20 12L28 28" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M16 20H24" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <div>
                      <h1 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.4rem', color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>Wegive</h1>
                      <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600, letterSpacing: '0.05em' }}>COMPLIANCE GATEWAY v2.4</span>
                    </div>
                  </div>

                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '20px', background: '#ECFDF5', border: '1px solid #A7F3D0', fontSize: '0.72rem', color: '#059669', fontWeight: 600 }}>
                    <span className="radar-dot" style={{ width: '6px', height: '6px' }}></span> Encrypted Rails
                  </div>
                </div>

                {/* Role Specific Header Banner */}
                {isAdminRoute ? (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: '12px', background: '#EFF6FF', border: '1px solid #BFDBFE', fontSize: '0.82rem', color: '#1D4ED8', fontWeight: 600, marginBottom: '20px', width: '100%', justifyContent: 'center' }}>
                    👑 Superadmin Master Access (`/admin`)
                  </div>
                ) : (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: '12px', background: '#ECFDF5', border: '1px solid #A7F3D0', fontSize: '0.82rem', color: '#047857', fontWeight: 600, marginBottom: '20px', width: '100%', justifyContent: 'center' }}>
                    🏢 NGO Partner Management Portal
                  </div>
                )}

                {/* Title & Subtitle based on Role & URL */}
                <div style={{ marginBottom: '24px' }}>
                  <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0F172A', marginBottom: '6px' }}>
                    {isAdminRoute ? 'Superadmin Master Authentication' : 'NGO Partner Portal Login'}
                  </h2>
                  <p style={{ fontSize: '0.82rem', color: '#64748B', margin: 0, lineHeight: 1.4 }}>
                    {isAdminRoute
                      ? 'Access global master ledger, platform settings, and NGO permissions oversight.'
                      : 'Manage campaign funds, Razorpay gateway sub-keys, and compliance receipts.'}
                  </p>
                </div>

                {/* Login Form */}
                <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  
                  {/* Email Field */}
                  <div className="form-group-cyber" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>Email Address</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="email"
                        autoComplete="username"
                        className="cyber-input"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="Enter email address"
                        required
                      />
                      <div className="cyber-input-icon">
                        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                      </div>
                    </div>
                  </div>

                  {/* Password Field */}
                  <div className="form-group-cyber" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>Password</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showLoginPassword ? "text" : "password"}
                        autoComplete="current-password"
                        className="cyber-input"
                        style={{ paddingRight: '42px' }}
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="Enter password"
                        required
                      />
                      <div className="cyber-input-icon">
                        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                        style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.95rem', color: '#64748B', padding: 0, outline: 'none' }}
                      >
                        {showLoginPassword ? '👁️' : '🙈'}
                      </button>
                    </div>
                  </div>

                  {/* Error message display */}
                  {loginError && (
                    <div style={{ padding: '10px 14px', borderRadius: '10px', background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#DC2626', fontSize: '0.82rem', textAlign: 'center' }}>
                      ⚠️ {loginError}
                    </div>
                  )}

                  {/* Submit Button */}
                  <button type="submit" className="btn-cyber-primary">
                    <span>Sign In to {activeLoginRole === 'superadmin' ? 'Superadmin Dashboard' : 'NGO Portal'}</span>
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                  </button>

                </form>
              </div>

              {/* Right Side: Clean Graphical Tech Panel (Light Mode) */}
              <div style={{ flex: '1 1 440px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Main Graphical Tech Card */}
                <div className="hologram-node-card" style={{ background: '#FFFFFF', padding: '36px', border: '1px solid #E2E8F0', borderRadius: '20px', boxShadow: '0 10px 30px -10px rgba(15, 23, 42, 0.05)' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: '20px', background: '#EFF6FF', border: '1px solid #BFDBFE', fontSize: '0.78rem', color: '#2563EB', fontWeight: 600, marginBottom: '18px' }}>
                    ⚡ Enterprise Non-Profit Infrastructure
                  </div>

                  <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0F172A', lineHeight: 1.3, marginBottom: '14px', letterSpacing: '-0.02em' }}>
                    Automated Compliance & Payment Rails
                  </h2>

                  <p style={{ fontSize: '0.9rem', color: '#64748B', lineHeight: 1.6, marginBottom: '24px' }}>
                    Wegive connects NGO external landing pages directly to automated Razorpay gateway sub-keys, instant cryptographically signed 80G tax receipts, and automated Meta WhatsApp donor retention flows.
                  </p>

                  {/* Tech Node Badges */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                    <div style={{ padding: '14px', borderRadius: '12px', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: '0.75rem', color: '#2563EB', fontWeight: 600 }}>🔒 Cryptographic Security</div>
                      <div style={{ fontSize: '0.85rem', color: '#0F172A', fontWeight: 700, marginTop: '2px' }}>SHA256 Hash Verification</div>
                    </div>

                    <div style={{ padding: '14px', borderRadius: '12px', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600 }}>⚡ Real-Time Engine</div>
                      <div style={{ fontSize: '0.85rem', color: '#0F172A', fontWeight: 700, marginTop: '2px' }}>WebSocket Live Feed</div>
                    </div>

                    <div style={{ padding: '14px', borderRadius: '12px', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: '0.75rem', color: '#D97706', fontWeight: 600 }}>📜 Compliance Audit</div>
                      <div style={{ fontSize: '0.85rem', color: '#0F172A', fontWeight: 700, marginTop: '2px' }}>80G & 501(c)(3) Auto PDF</div>
                    </div>

                    <div style={{ padding: '14px', borderRadius: '12px', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: '0.75rem', color: '#9333EA', fontWeight: 600 }}>🤖 AI Copilot</div>
                      <div style={{ fontSize: '0.85rem', color: '#0F172A', fontWeight: 700, marginTop: '2px' }}>Gemini Donor Retention</div>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          </div>
        </div>
      )}

      {(!showLandingView && !showLoginView) && (
        <div className="app-container" style={{ flex: 1 }}>
          
          <aside className="sidebar">
            <div className="brand-section">
              <svg width="32" height="32" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="40" height="40" rx="8" fill="url(#sidebarG)" />
                <path d="M12 28L20 12L28 28" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16 20H24" stroke="white" strokeWidth="3" strokeLinecap="round"/>
                <defs>
                  <linearGradient id="sidebarG" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#059669" />
                    <stop offset="1" stopColor="#10B981" />
                  </linearGradient>
                </defs>
              </svg>
              <span className="brand-name">{userSession?.user?.role === 'superadmin' ? 'Wegive Admin' : 'Wegive'}</span>
            </div>

            <nav style={{ flex: 1 }}>
              <ul className="nav-links">
                {userSession?.user?.role === 'superadmin' ? (
                  <>
                    <li>
                      <a href="#overview" className={`nav-link ${currentPath === '/superadmin' && activeSuperadminTab === 'overview' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); navigate('/superadmin'); setActiveSuperadminTab('overview'); }}>
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z"/></svg>
                        Dashboard
                      </a>
                    </li>
                    <li>
                      <a href="#ngos" className={`nav-link ${currentPath === '/superadmin' && activeSuperadminTab === 'ngos' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); navigate('/superadmin'); setActiveSuperadminTab('ngos'); }}>
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
                        NGOs & Permissions
                      </a>
                    </li>
                    <li>
                      <a href="#campaigns" className={`nav-link ${currentPath === '/superadmin' && activeSuperadminTab === 'campaigns' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); navigate('/superadmin'); setActiveSuperadminTab('campaigns'); }}>
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        Campaigns & Gateway Keys
                      </a>
                    </li>
                    <li>
                      <a href="#breakdown" className={`nav-link ${currentPath === '/superadmin' && activeSuperadminTab === 'breakdown' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); navigate('/superadmin'); setActiveSuperadminTab('breakdown'); }}>
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                        Money Breakdown
                      </a>
                    </li>
                    <li>
                      <a href="#ledger" className={`nav-link ${currentPath === '/superadmin' && activeSuperadminTab === 'transactions' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); navigate('/superadmin'); setActiveSuperadminTab('transactions'); }}>
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>
                        Master Ledger
                      </a>
                    </li>
                    <li>
                      <a href="#settings" className={`nav-link ${currentPath === '/superadmin' && activeSuperadminTab === 'settings' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); navigate('/superadmin'); setActiveSuperadminTab('settings'); }}>
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                        Settings
                      </a>
                    </li>
                  </>
                ) : (
                  <>
                    <li>
                      <a href="#ngo-overview" className={`nav-link ${currentPath === '/ngo' && activeNgoTab === 'overview' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); navigate('/ngo'); setActiveNgoTab('overview'); }}>
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z"/></svg>
                        Dashboard
                      </a>
                    </li>
                    <li>
                      <a href="#ngo-campaigns" className={`nav-link ${currentPath === '/ngo' && activeNgoTab === 'campaigns' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); navigate('/ngo'); setActiveNgoTab('campaigns'); }}>
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        Campaigns
                      </a>
                    </li>
                    <li>
                      <a href="#ngo-transactions" className={`nav-link ${currentPath === '/ngo' && activeNgoTab === 'transactions' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); navigate('/ngo'); setActiveNgoTab('transactions'); }}>
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>
                        Donations Ledger
                      </a>
                    </li>
                    <li>
                      <a href="#ngo-breakdown" className={`nav-link ${currentPath === '/ngo' && activeNgoTab === 'breakdown' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); navigate('/ngo'); setActiveNgoTab('breakdown'); }}>
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                        Money Breakdown
                      </a>
                    </li>
                    <li>
                      <a href="#ngo-compliance" className={`nav-link ${currentPath === '/ngo' && activeNgoTab === 'compliance' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); navigate('/ngo'); setActiveNgoTab('compliance'); }}>
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                        Compliance Config
                      </a>
                    </li>
                  </>
                )}
              </ul>
            </nav>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Logged in as:<br/><strong>{userSession?.user?.email || 'Guest'}</strong>
              </div>
              {userSession ? (
                <button onClick={handleLogout} className="btn btn-secondary" style={{ width: '100%', padding: '6px 12px', fontSize: '0.85rem' }}>Logout</button>
              ) : (
                <button onClick={(e) => { e.preventDefault(); navigate('/login'); }} className="btn btn-primary" style={{ width: '100%', padding: '6px 12px', fontSize: '0.85rem' }}>Login</button>
              )}
            </div>
          </aside>

          <main className="main-content">
            
            {currentPath === '/ngo' && (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', height: '100%' }}>
                <div className="page-header" style={{ marginBottom: '20px', flexShrink: 0 }}>
                  <div>
                    <h2>{userSession?.user?.orgName || 'WaterAid India'} Workspace</h2>
                    <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                      {activeNgoTab === 'overview' && 'Review contributions metrics, active campaign scopes, and copilot letter helpers.'}
                      {activeNgoTab === 'campaigns' && 'Create, edit, and launch donation campaigns for your organization.'}
                      {activeNgoTab === 'transactions' && 'Track incoming payments, check settlement compliance, and download certificates.'}
                      {activeNgoTab === 'compliance' && 'Configure dynamic tax stamps, signatory officers, and Meta WhatsApp webhooks.'}
                    </p>
                  </div>
                  <a href="/api/compliance/export/10bd" className="btn btn-primary" download>Export Form 10BD CSV</a>
                </div>

                {/* NGO Tab 1: Overview */}
                {activeNgoTab === 'overview' && (
                  <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
                    <div className="grid grid-cols-4" style={{ marginBottom: '24px' }}>
                      <div className="card stat-card" style={{ borderLeft: '4px solid var(--primary)', padding: '16px' }}>
                        <span className="stat-label">Gross Contributions</span>
                        <span className="stat-value" style={{ fontSize: '1.5rem' }}>
                          ₹{donations.filter(d => d.currency === 'INR' && d.status === 'completed')
                                     .reduce((acc, curr) => acc + Number(curr.amount), 0)
                                     .toLocaleString()}
                        </span>
                      </div>
                      <div className="card stat-card" style={{ borderLeft: '4px solid var(--secondary)', padding: '16px' }}>
                        <span className="stat-label">Total Donors</span>
                        <span className="stat-value" style={{ fontSize: '1.5rem' }}>{new Set(donations.map(d => d.donorEmail)).size} Donors</span>
                      </div>
                      <div className="card stat-card" style={{ borderLeft: '4px solid #3B82F6', padding: '16px' }}>
                        <span className="stat-label">Completed Payments</span>
                        <span className="stat-value" style={{ fontSize: '1.5rem' }}>{donations.filter(d => d.status === 'completed').length} Contributions</span>
                      </div>
                      <div className="card stat-card" style={{ borderLeft: '4px solid #F59E0B', padding: '16px' }}>
                        <span className="stat-label">Average Donation</span>
                        <span className="stat-value" style={{ fontSize: '1.5rem' }}>
                          ₹{donations.filter(d => d.currency === 'INR' && d.status === 'completed').length > 0 
                            ? Math.round(donations.filter(d => d.currency === 'INR' && d.status === 'completed').reduce((acc, curr) => acc + Number(curr.amount), 0) / donations.filter(d => d.currency === 'INR' && d.status === 'completed').length).toLocaleString()
                            : 0}
                        </span>
                      </div>
                    </div>

                    {/* AI Assistant Section */}
                    <div className="card" style={{ marginBottom: '24px', borderLeft: '4px solid var(--primary)' }}>
                      <h3 style={{ marginBottom: '12px' }}>✨ AI Thank-You Email Copilot</h3>
                      <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '0.9rem' }}>Generate customized emails to donors using your active OpenAI API key.</p>
                      <button onClick={handleDraftEmail} className="btn btn-primary" disabled={isLoadingCopilot}>
                        {isLoadingCopilot ? 'Generating draft...' : 'Draft email helper'}
                      </button>
                      {copilotText && (
                        <div style={{ marginTop: '16px', backgroundColor: 'var(--background)', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-sans)', fontSize: '0.9rem' }}>{copilotText}</pre>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* NGO Tab 2: Campaigns */}
                {activeNgoTab === 'campaigns' && (
                  <div style={{ display: 'flex', gap: '24px', alignItems: 'stretch', flex: 1, overflow: 'hidden', minHeight: 0, paddingBottom: '8px' }}>
                    {/* Left List Card (60%) */}
                    <div className="card" style={{ flex: '1 1 60%', display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%' }}>
                      <h3 style={{ marginBottom: '16px', flexShrink: 0 }}>Active Campaigns</h3>
                      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Title</th>
                              <th>URL Slug</th>
                              <th>Status</th>
                              <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {campaigns.map((camp) => (
                              <tr key={camp.id}>
                                <td><strong>{camp.title}</strong></td>
                                <td><code>/{camp.slug}</code></td>
                                <td>
                                  <span className={`badge ${camp.is_active ? 'badge-success' : 'badge-failed'}`}>
                                    {camp.is_active ? 'Active' : 'Inactive'}
                                  </span>
                                </td>
                                <td>
                                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                    <button 
                                      onClick={() => {
                                        setEditingCampId(camp.id);
                                        setEditCampTitle(camp.title);
                                        setEditCampSlug(camp.slug || '');
                                        setEditCampActive(camp.is_active);
                                      }} 
                                      className="btn btn-secondary" 
                                      style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                                    >
                                      Edit
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteNgoCampaign(camp.id)} 
                                      className="btn btn-secondary" 
                                      style={{ padding: '4px 10px', fontSize: '0.75rem', color: 'var(--error)' }}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                            {campaigns.length === 0 && (
                              <tr>
                                <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-light)', padding: '20px' }}>No campaigns found.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Right Editor Card (40%) */}
                    <div className="card" style={{ flex: '1 1 40%', overflowY: 'auto', height: '100%' }}>
                      {editingCampId ? (
                        <div>
                          <h3 style={{ marginBottom: '16px', color: 'var(--primary)' }}>Edit Campaign Details</h3>
                          <form onSubmit={handleUpdateNgoCampaign} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div className="form-group">
                              <label className="form-label">Campaign Title</label>
                              <input type="text" className="form-input" value={editCampTitle} onChange={(e) => setEditCampTitle(e.target.value)} required />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Campaign Slug</label>
                              <input type="text" className="form-input" value={editCampSlug} onChange={(e) => setEditCampSlug(e.target.value)} required />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Campaign Status</label>
                              <select className="form-input" value={editCampActive ? 'true' : 'false'} onChange={(e) => setEditCampActive(e.target.value === 'true')}>
                                <option value="true">Active</option>
                                <option value="false">Inactive</option>
                              </select>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
                              <button type="button" onClick={() => setEditingCampId(null)} className="btn btn-secondary">Cancel</button>
                              <button type="submit" className="btn btn-primary">Save Changes</button>
                            </div>
                          </form>
                        </div>
                      ) : (
                        <div>
                          <h3 style={{ marginBottom: '16px' }}>Create New Campaign</h3>
                          <form onSubmit={handleCreateNgoCampaign} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div className="form-group">
                              <label className="form-label">Campaign Title</label>
                              <input type="text" className="form-input" value={newCampTitle} onChange={(e) => setNewCampTitle(e.target.value)} required />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Campaign Slug</label>
                              <input type="text" className="form-input" value={newCampSlug} onChange={(e) => setNewCampSlug(e.target.value)} required />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Description</label>
                              <textarea className="form-input" rows={3} style={{ fontFamily: 'inherit' }} value={newCampDescription} onChange={(e) => setNewCampDescription(e.target.value)} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                              <button type="submit" className="btn btn-primary">Create Campaign</button>
                            </div>
                          </form>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* NGO Tab 3: Donations Ledger */}
                {activeNgoTab === 'transactions' && (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minHeight: 0, paddingBottom: '8px' }}>
                    <div className="card" style={{ marginBottom: '16px', flexShrink: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0 }}>Transactions Ledger</h3>
                        <div style={{ width: '300px' }}>
                          <input 
                            type="text" 
                            className="form-input" 
                            placeholder="Search by donor name or email..."
                            value={donorSearchQuery}
                            onChange={(e) => setDonorSearchQuery(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
                      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Donor Name</th>
                              <th>Email</th>
                              <th>Campaign</th>
                              <th>Gateway</th>
                              <th>Amount</th>
                              <th>Status</th>
                              <th style={{ textAlign: 'right' }}>Receipt</th>
                            </tr>
                          </thead>
                          <tbody>
                            {donations
                              .filter(d => {
                                const q = donorSearchQuery.toLowerCase();
                                return (
                                  d.donorName.toLowerCase().includes(q) || 
                                  d.donorEmail.toLowerCase().includes(q)
                                );
                              })
                              .map((d) => (
                                <tr key={d.id}>
                                  <td>{new Date(d.created_at || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                  <td><strong>{d.donorName}</strong></td>
                                  <td>{d.donorEmail}</td>
                                  <td>{d.campaignTitle || 'General Support'}</td>
                                  <td><span style={{ textTransform: 'uppercase' }}>{d.paymentGateway}</span></td>
                                  <td>{d.currency} {Number(d.amount).toLocaleString()}</td>
                                  <td>
                                    <span className={`badge ${d.status === 'completed' ? 'badge-success' : 'badge-failed'}`}>
                                      {d.status}
                                    </span>
                                  </td>
                                  <td style={{ textAlign: 'right' }}>
                                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                      <button 
                                        onClick={() => setSelectedDonationForModal(d)} 
                                        className="btn btn-secondary" 
                                        style={{ padding: '4px 8px', fontSize: '0.75rem', color: '#2563EB', borderColor: '#BFDBFE' }}
                                      >
                                        🔍 Full Razorpay Data
                                      </button>
                                      {d.status === 'completed' && (
                                        <a href={`/api/compliance/receipts/${d.id}`} target="_blank" className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
                                          PDF Receipt
                                        </a>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            {donations.length === 0 && (
                              <tr>
                                <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-light)', padding: '20px' }}>No contributions found.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                         {/* NGO Tab 3B: Money Breakdown */}
                {activeNgoTab === 'breakdown' && (
                  <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', paddingBottom: '16px' }}>
                    <div className="card" style={{ marginBottom: '24px' }}>
                      <h3 style={{ marginBottom: '8px', color: 'var(--primary)' }}>💰 NGO Payout & Money Breakdown</h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '20px' }}>
                        Track gross donations raised across all campaigns, platform service commissions, and net money payouts.
                      </p>

                      <div className="grid grid-cols-3" style={{ marginBottom: '24px' }}>
                        <div className="card stat-card" style={{ borderLeft: '4px solid var(--primary)', padding: '16px' }}>
                          <span className="stat-label">Gross Raised Volume</span>
                          <span className="stat-value" style={{ fontSize: '1.4rem' }}>
                            ₹{donations.filter(d => d.status === 'completed').reduce((acc, curr) => acc + Number(curr.amount), 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="card stat-card" style={{ borderLeft: '4px solid #F59E0B', padding: '16px' }}>
                          <span className="stat-label">Platform Service Fee (2%)</span>
                          <span className="stat-value" style={{ fontSize: '1.4rem', color: '#F59E0B' }}>
                            - ₹{Math.round(donations.filter(d => d.status === 'completed').reduce((acc, curr) => acc + (Number(curr.amount) * 0.02), 0)).toLocaleString()}
                          </span>
                        </div>
                        <div className="card stat-card" style={{ borderLeft: '4px solid #10B981', padding: '16px' }}>
                          <span className="stat-label">Net Bank Payout</span>
                          <span className="stat-value" style={{ fontSize: '1.4rem', color: '#10B981' }}>
                            ₹{Math.round(donations.filter(d => d.status === 'completed').reduce((acc, curr) => acc + (Number(curr.amount) * 0.98), 0)).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Campaign</th>
                            <th>Donors</th>
                            <th>Gross Raised</th>
                            <th>Platform Fee</th>
                            <th>Net Campaign Payout</th>
                          </tr>
                        </thead>
                        <tbody>
                          {campaigns.map((c) => {
                            const cDonations = donations.filter(d => d.campaignTitle === c.title && d.status === 'completed');
                            const gross = cDonations.reduce((acc, curr) => acc + Number(curr.amount), 0);
                            const pFee = Math.round(gross * 0.02);
                            const net = gross - pFee;
                            return (
                              <tr key={c.id}>
                                <td><strong>{c.title}</strong></td>
                                <td>{cDonations.length} donors</td>
                                <td>₹{gross.toLocaleString()}</td>
                                <td style={{ color: '#F59E0B' }}>- ₹{pFee.toLocaleString()}</td>
                                <td><strong style={{ color: '#059669' }}>₹{net.toLocaleString()}</strong></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* NGO Tab 4: Compliance Configuration */}
                {activeNgoTab === 'compliance' && (
                  <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '16px' }}>
                    <div className="card" style={{ maxWidth: '750px', padding: '32px', margin: '0 auto' }}>
                      <h3 style={{ fontSize: '1.25rem', marginBottom: '8px', color: 'var(--primary)' }}>
                        🏢 NGO Compliance Settings & Credentials
                      </h3>
                      <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.88rem' }}>
                        Update organization identity, 80G tax stamp credentials, and Meta WABA tokens.
                      </p>

                      <form onSubmit={handleUpdateNGO} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div className="form-group">
                          <label className="form-label">NGO Organization Name</label>
                          <input type="text" className="form-input" value={editNgoName} onChange={(e) => setEditNgoName(e.target.value)} required />
                        </div>

                        <div style={{ display: 'flex', gap: '16px' }}>
                          <div className="form-group" style={{ flex: 1 }}>
                            <label className="form-label">Country Jurisdiction</label>
                            <select className="form-input" value={editNgoCountry} onChange={(e) => setEditNgoCountry(e.target.value)}>
                              <option value="IN">India (IN)</option>
                              <option value="US">United States (US)</option>
                              <option value="GB">United Kingdom (GB)</option>
                            </select>
                          </div>
                          <div className="form-group" style={{ flex: 1 }}>
                            <label className="form-label">Primary Currency</label>
                            <select className="form-input" value={editNgoCurrency} onChange={(e) => setEditNgoCurrency(e.target.value)}>
                              <option value="INR">INR (₹)</option>
                              <option value="USD">USD ($)</option>
                              <option value="GBP">GBP (£)</option>
                            </select>
                          </div>
                        </div>

                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
                          <h4 style={{ fontSize: '1rem', color: 'var(--primary)', marginBottom: '14px' }}>💬 WhatsApp Meta API Settings</h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div className="form-group">
                              <label className="form-label">WABA ID (WhatsApp Business Account ID)</label>
                              <input type="text" className="form-input" value={editWabaId} onChange={(e) => setEditWabaId(e.target.value)} placeholder="WABA Account Identifier" />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Phone Number ID</label>
                              <input type="text" className="form-input" value={editPhoneId} onChange={(e) => setEditPhoneId(e.target.value)} placeholder="Meta WABA phone node ID" />
                            </div>
                            <div className="form-group">
                              <label className="form-label">API Access Token</label>
                              <input type="text" className="form-input" value={editWabaToken} onChange={(e) => setEditWabaToken(e.target.value)} placeholder="EAAB..." />
                            </div>
                          </div>
                        </div>

                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
                          <h4 style={{ fontSize: '1rem', color: 'var(--primary)', marginBottom: '14px' }}>🛡️ 80G Statutory Certificate Details</h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div className="form-group">
                              <label className="form-label">Registration URN (Unique Registration Number)</label>
                              <input type="text" className="form-input" value={edit80gUrn} onChange={(e) => setEdit80gUrn(e.target.value)} placeholder="e.g. AAATD0192K20261" />
                            </div>
                            <div className="form-group">
                              <label className="form-label">URN Approval Date</label>
                              <input type="date" className="form-input" value={edit80gDate} onChange={(e) => setEdit80gDate(e.target.value)} />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Digital Signatory Officer name</label>
                              <input type="text" className="form-input" value={edit80gSignatory} onChange={(e) => setEdit80gSignatory(e.target.value)} placeholder="e.g. Country Director India" />
                            </div>
                          </div>
                        </div>

                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
                          <h4 style={{ fontSize: '1rem', color: 'var(--primary)', marginBottom: '14px' }}>💳 Razorpay Gateways Configuration</h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div className="form-group">
                              <label className="form-label">Razorpay Key ID</label>
                              <input type="text" className="form-input" value={editNgoRazorpayKeyId} onChange={(e) => setEditNgoRazorpayKeyId(e.target.value)} placeholder="rzp_test_..." />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Razorpay Key Secret</label>
                              <input type="password" className="form-input" value={editNgoRazorpayKeySecret} onChange={(e) => setEditNgoRazorpayKeySecret(e.target.value)} placeholder="Secret Token" />
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '20px', marginTop: '8px' }}>
                          <button type="submit" className="btn btn-primary" style={{ padding: '10px 24px' }}>
                            Save Configurations
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            )}

            {currentPath === '/superadmin' && (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', paddingRight: '6px', minHeight: 0 }}>
                
                {/* 1. OVERVIEW SUBTAB (DASHBOARD) */}
                {activeSuperadminTab === 'overview' && (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', paddingRight: '6px' }}>
                    <div className="page-header" style={{ marginBottom: '20px', flexShrink: 0 }}>
                      <div>
                        <h2>Platform Performance & Overview</h2>
                        <p style={{ color: 'var(--text-secondary)' }}>Live platform volumes, revenue metrics, and shortcut task triggers.</p>
                      </div>
                    </div>

                    {/* 4 Stat Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                      <div className="card stat-card" style={{ borderLeft: '4px solid var(--primary)', padding: '16px' }}>
                        <span className="stat-label">Total System NGOs</span>
                        <span className="stat-value" style={{ fontSize: '1.5rem', color: 'var(--primary)' }}>{globalMetrics.totalOrganizations} Registered</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Active non-profit orgs</span>
                      </div>
                      <div className="card stat-card" style={{ borderLeft: '4px solid var(--secondary)', padding: '16px' }}>
                        <span className="stat-label">Gross Platform Volume (GMV)</span>
                        <span className="stat-value" style={{ fontSize: '1.5rem', color: 'var(--secondary)' }}>₹{globalMetrics.grossVolumeGMV.toLocaleString()}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Total volume raised</span>
                      </div>
                      <div className="card stat-card" style={{ borderLeft: '4px solid #10B981', padding: '16px' }}>
                        <span className="stat-label">Active Donors</span>
                        <span className="stat-value" style={{ fontSize: '1.5rem', color: '#10B981' }}>{globalMetrics.activeDonors} Donors</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Unique supporters</span>
                      </div>
                      <div className="card stat-card" style={{ borderLeft: '4px solid var(--info)', padding: '16px' }}>
                        <span className="stat-label">Platform Fees Revenue</span>
                        <span className="stat-value" style={{ fontSize: '1.5rem', color: 'var(--info)' }}>₹{globalMetrics.platformFeeRevenue.toLocaleString()}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>0.00% Free Platform</span>
                      </div>
                    </div>

                    {/* Real-time SVG Charts Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '24px' }}>
                      {/* Left: 14-Day GMV Volume Timeline (Line Graph) */}
                      <div className="card" style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                          <div>
                            <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)' }}>📈 14-Day GMV Donation Volume Trend</h3>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Real-time PostgreSQL date-truncated time-series line graph</span>
                          </div>
                          <span style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '12px', background: '#EFF6FF', color: '#1D4ED8', fontWeight: 600 }}>
                            ⚡ Live Feed
                          </span>
                        </div>
                        <AnalyticsLineGraph timeline={analyticsData?.timeline || []} />
                      </div>

                      {/* Right: Payment Gateway Distribution (Donut / Pie Chart) */}
                      <div className="card" style={{ padding: '24px' }}>
                        <div style={{ marginBottom: '16px' }}>
                          <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)' }}>💳 Settlement Gateway Breakdown</h3>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Real-time volume split by payment rails</span>
                        </div>
                        <AnalyticsPieChart
                          items={(analyticsData?.gateways || []).map((g: any, idx: number) => {
                            const palette = ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899'];
                            return {
                              label: g.payment_gateway || 'Razorpay Gateway',
                              value: Number(g.total_amount) || 0,
                              color: palette[idx % palette.length]
                            };
                          })}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                      {/* NGO Volume Share (Bar Chart) */}
                      <div className="card" style={{ padding: '24px' }}>
                        <div style={{ marginBottom: '16px' }}>
                          <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)' }}>🏛️ NGO Volume Contribution Shares</h3>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Relative proportion of total funds raised per NGO</span>
                        </div>
                        <AnalyticsBarChart data={analyticsData?.ngoDistribution || []} />
                      </div>

                      {/* Payment Method Share (Donut / Pie Chart) */}
                      <div className="card" style={{ padding: '24px' }}>
                        <div style={{ marginBottom: '16px' }}>
                          <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)' }}>📱 Donor Payment Instruments</h3>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>UPI, Cards, Netbanking & Wallets split</span>
                        </div>
                        <AnalyticsPieChart
                          items={(analyticsData?.methods || []).map((m: any, idx: number) => {
                            const palette = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B'];
                            return {
                              label: (m.method || 'upi').toUpperCase(),
                              value: Number(m.total_amount) || 0,
                              color: palette[idx % palette.length]
                            };
                          })}
                        />
                      </div>
                    </div>

                    <div className="card" style={{ padding: '24px' }}>
                      <h3 style={{ marginBottom: '16px', color: 'var(--primary)' }}>⚡ Administrative Actions Dashboard</h3>
                      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                        <button onClick={() => setShowAddNgoModal(true)} className="btn btn-primary" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                          Register New NGO
                        </button>
                        <button onClick={() => setShowAddCampaignModal(true)} className="btn btn-secondary" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                          Create New Campaign
                        </button>
                        <button onClick={() => setActiveSuperadminTab('transactions')} className="btn btn-secondary">
                          Inspect Master Ledger
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. NGOs DIRECTORY & PERMISSIONS SUBTAB */}
                {activeSuperadminTab === 'ngos' && (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', paddingRight: '6px' }}>
                    <div className="page-header" style={{ marginBottom: '20px', flexShrink: 0 }}>
                      <div>
                        <h2>NGOs Directory & Platform Permissions</h2>
                        <p style={{ color: 'var(--text-secondary)' }}>Grant or restrict specific actions, fee rates, and Razorpay gateway keys for all NGOs.</p>
                      </div>
                      <button onClick={() => setShowAddNgoModal(true)} className="btn btn-primary">Register New NGO</button>
                    </div>

                    <div className="card">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>NGO Details</th>
                            <th>Status & Gateway Key</th>
                            <th>Platform Permissions</th>
                            <th>Fee %</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {organizations.map((org) => {
                            const gateways = org.payment_gateways_config || {};
                            const perms = org.permissions || {};
                            const isSuspended = org.status === 'suspended';
                            return (
                              <tr key={org.id}>
                                <td>
                                  <div style={{ fontWeight: 600 }}>{org.name}</div>
                                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{org.tax_id_country} &bull; {org.primary_currency}</span>
                                  <br/><code style={{ fontSize: '0.75rem' }}>/{org.slug}</code>
                                </td>
                                <td>
                                  <span className={`badge ${isSuspended ? 'badge-failed' : 'badge-success'}`}>
                                    {org.status || 'Active'}
                                  </span>
                                  <div style={{ marginTop: '4px', fontSize: '0.78rem' }}>
                                    Razorpay Key: {gateways.razorpay_key_id ? <code>{gateways.razorpay_key_id}</code> : <span style={{ color: 'var(--text-light)' }}>System Default</span>}
                                  </div>
                                </td>
                                <td>
                                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                    <span className={`badge ${perms.can_accept_donations !== false ? 'badge-success' : 'badge-failed'}`}>
                                      {perms.can_accept_donations !== false ? '✓ Accept Payments' : '✕ Blocked'}
                                    </span>
                                    <span className={`badge ${perms.can_issue_80g_receipts !== false ? 'badge-success' : 'badge-failed'}`}>
                                      {perms.can_issue_80g_receipts !== false ? '✓ 80G Receipts' : '✕ No Receipts'}
                                    </span>
                                    <span className={`badge ${perms.can_export_data !== false ? 'badge-success' : 'badge-failed'}`}>
                                      {perms.can_export_data !== false ? '✓ Export CSV' : '✕ No Export'}
                                    </span>
                                  </div>
                                </td>
                                <td>
                                  <strong style={{ color: 'var(--primary)' }}>{perms.platform_fee_percent || 2.0}%</strong>
                                </td>
                                <td>
                                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                    <button 
                                      onClick={() => handleProvisionNgoKey(org.id)}
                                      className="btn btn-secondary"
                                      style={{ padding: '4px 8px', fontSize: '0.75rem', color: '#059669', borderColor: '#A7F3D0' }}
                                      title="Auto-generate Managed Razorpay Gateway Key under DanaPro Master Account"
                                    >
                                      ⚡ Auto-Provision Key
                                    </button>
                                    <button 
                                      onClick={() => {
                                        setEditingNgoId(org.id);
                                        setEditNgoName(org.name);
                                        setEditNgoSlug(org.slug);
                                        setEditNgoCountry(org.tax_id_country || 'IN');
                                        setEditNgoCurrency(org.primary_currency || 'INR');
                                        setEditNgoStatus(org.status || 'active');
                                        const waba = org.whatsapp_meta_config || {};
                                        const cert = org.certificate_80g_config || {};
                                        setEditWabaId(waba.waba_id || '');
                                        setEditPhoneId(waba.phone_id || '');
                                        setEditWabaToken(waba.token || '');
                                        setEdit80gUrn(cert.urn || '');
                                        setEdit80gDate(cert.issue_date || '');
                                        setEdit80gSignatory(cert.signatory || '');
                                        setEditNgoRazorpayKeyId(gateways.razorpay_key_id || '');
                                        setEditNgoRazorpayKeySecret(gateways.razorpay_key_secret || '');
                                        setEditNgoCanAccept(perms.can_accept_donations !== false);
                                        setEditNgoCan80g(perms.can_issue_80g_receipts !== false);
                                        setEditNgoCanExport(perms.can_export_data !== false);
                                        setEditNgoCanAi(perms.can_run_ai_analytics !== false);
                                        setEditNgoFeePercent(perms.platform_fee_percent || 2.0);
                                      }} 
                                      className="btn btn-secondary" 
                                      style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                                    >
                                      Permissions & Keys
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteNGO(org.id)} 
                                      className="btn btn-secondary" 
                                      style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--error)' }}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 3. CAMPAIGNS & SPECIFIC GATEWAY KEYS SUBTAB */}
                {activeSuperadminTab === 'campaigns' && (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', paddingRight: '6px' }}>
                    <div className="page-header" style={{ marginBottom: '20px', flexShrink: 0 }}>
                      <div>
                        <h2>Campaigns Oversight & Specific Razorpay Keys</h2>
                        <p style={{ color: 'var(--text-secondary)' }}>Assign specific Razorpay Key IDs & Secrets per campaign to route donations directly to NGO accounts.</p>
                      </div>
                      <button onClick={() => setShowAddCampaignModal(true)} className="btn btn-primary">Create New Campaign</button>
                    </div>

                    <div className="card">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Campaign Title</th>
                            <th>DanaPro API Key</th>
                            <th>External Landing Page URL</th>
                            <th>NGO Owner</th>
                            <th>Target Goal</th>
                            <th>Razorpay Key</th>
                            <th>Status</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {campaigns.map((camp) => {
                            const pConfig = camp.payment_config || {};
                            const campKeyId = pConfig.razorpay_key_id;
                            const apiKey = camp.api_key || `dp_live_${camp.slug}_key`;
                            return (
                              <tr key={camp.id}>
                                <td>
                                  <strong>{camp.title}</strong>
                                  <br/><code style={{ fontSize: '0.75rem' }}>/{camp.slug}</code>
                                </td>
                                <td>
                                  <code 
                                    onClick={() => {
                                      navigator.clipboard.writeText(apiKey);
                                      alert(`Copied DanaPro API Key: ${apiKey}`);
                                    }}
                                    title="Click to copy DanaPro API Key"
                                    style={{ fontSize: '0.75rem', color: '#2563EB', background: '#EFF6FF', padding: '3px 8px', borderRadius: '4px', border: '1px solid #BFDBFE', cursor: 'pointer' }}
                                  >
                                    📋 {apiKey.slice(0, 18)}...
                                  </code>
                                </td>
                                <td>
                                  {camp.landing_page_url ? (
                                    <a href={camp.landing_page_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.78rem', color: '#059669', textDecoration: 'underline' }}>
                                      🌐 {camp.landing_page_url.replace(/^https?:\/\//, '')}
                                    </a>
                                  ) : (
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>Not Configured</span>
                                  )}
                                </td>
                                <td>{camp.orgName || 'WaterAid India'}</td>
                                <td>₹{Number(camp.goal_amount || 0).toLocaleString()}</td>
                                <td>
                                  {campKeyId ? (
                                    <code style={{ fontSize: '0.78rem', color: '#059669', background: '#ECFDF5', padding: '2px 6px', borderRadius: '4px' }}>
                                      🔑 {campKeyId}
                                    </code>
                                  ) : (
                                    <span style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>Using NGO Fallback</span>
                                  )}
                                </td>
                                <td>
                                  <span className={`badge ${camp.is_active ? 'badge-success' : 'badge-failed'}`}>
                                    {camp.is_active ? 'Active' : 'Inactive'}
                                  </span>
                                </td>
                                <td>
                                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                    <button 
                                      onClick={() => handleProvisionCampaignKey(camp.id)}
                                      className="btn btn-secondary"
                                      style={{ padding: '4px 8px', fontSize: '0.75rem', color: '#059669', borderColor: '#A7F3D0' }}
                                      title="Auto-generate Managed Razorpay Sub-Key under DanaPro Master Gateway"
                                    >
                                      ⚡ Provision Sub-Key
                                    </button>
                                    <button 
                                      onClick={() => setSelectedCampForEmbedModal(camp)}
                                      className="btn btn-secondary"
                                      style={{ padding: '4px 8px', fontSize: '0.75rem', color: '#2563EB', borderColor: '#BFDBFE' }}
                                    >
                                      🔌 Embed Code & Webhook
                                    </button>
                                    <button 
                                      onClick={() => {
                                        setEditingCampId(camp.id);
                                        setEditCampTitle(camp.title);
                                        setEditCampSlug(camp.slug || '');
                                        setEditCampLandingPageUrl(camp.landing_page_url || '');
                                        setEditCampActive(camp.is_active);
                                        setEditCampGoalAmount(camp.goal_amount || 100000);
                                        setEditCampRazorpayKeyId(pConfig.razorpay_key_id || '');
                                        setEditCampRazorpayKeySecret(pConfig.razorpay_key_secret || '');
                                        const cPerms = camp.permissions || {};
                                        setEditCampAllowAnon(cPerms.allow_anonymous !== false);
                                        setEditCampTaxEnabled(cPerms.tax_receipt_enabled !== false);
                                      }} 
                                      className="btn btn-secondary" 
                                      style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                                    >
                                      Edit Keys & Config
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteCampaign(camp.id)} 
                                      className="btn btn-secondary" 
                                      style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--error)' }}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 3B. MONEY BREAKDOWN SUBTAB */}
                {activeSuperadminTab === 'breakdown' && (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', paddingRight: '6px' }}>
                    <div className="page-header" style={{ marginBottom: '20px', flexShrink: 0 }}>
                      <div>
                        <h2>Financial & Payout Breakdown Monitor</h2>
                        <p style={{ color: 'var(--text-secondary)' }}>Real-time breakdown of gross donations raised, platform commission fees, donor fee coverage, and net NGO payouts.</p>
                      </div>
                      <button onClick={fetchData} className="btn btn-secondary" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span>🔄</span> Refresh Financials
                      </button>
                    </div>

                    {breakdownData && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                          <div className="card stat-card" style={{ borderLeft: '4px solid var(--primary)', padding: '16px' }}>
                            <span className="stat-label">Gross Donations (GMV)</span>
                            <span className="stat-value" style={{ fontSize: '1.5rem', color: 'var(--primary)' }}>
                              ₹{Number(breakdownData.summary?.gross_gmv || 0).toLocaleString()}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Total volume raised</span>
                          </div>
                          <div className="card stat-card" style={{ borderLeft: '4px solid #10B981', padding: '16px' }}>
                            <span className="stat-label">Donor Fee Covered</span>
                            <span className="stat-value" style={{ fontSize: '1.5rem', color: '#10B981' }}>
                              ₹{Number(breakdownData.summary?.total_donor_fee_covered || 0).toLocaleString()}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Extra donor tips</span>
                          </div>
                          <div className="card stat-card" style={{ borderLeft: '4px solid #F59E0B', padding: '16px' }}>
                            <span className="stat-label">Platform Service Revenue</span>
                            <span className="stat-value" style={{ fontSize: '1.5rem', color: '#F59E0B' }}>
                              ₹{Number(breakdownData.summary?.total_platform_fee || 0).toLocaleString()}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>DanaPro platform fee</span>
                          </div>
                          <div className="card stat-card" style={{ borderLeft: '4px solid #3B82F6', padding: '16px' }}>
                            <span className="stat-label">Net NGO Payout</span>
                            <span className="stat-value" style={{ fontSize: '1.5rem', color: '#3B82F6' }}>
                              ₹{Number(breakdownData.summary?.total_ngo_net_payout || 0).toLocaleString()}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Net money received by NGOs</span>
                          </div>
                        </div>

                        {/* Breakdown per NGO Table */}
                        <div className="card" style={{ marginBottom: '24px' }}>
                          <h3 style={{ marginBottom: '16px', color: 'var(--primary)' }}>🏛️ Per-NGO Financial Payout Breakdown</h3>
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th>NGO Name</th>
                                <th>Active Campaigns</th>
                                <th>Donations</th>
                                <th>Gross Volume</th>
                                <th>Platform Fee</th>
                                <th>Net Payout to NGO</th>
                                <th>Razorpay Key</th>
                              </tr>
                            </thead>
                            <tbody>
                              {breakdownData.ngoBreakdown?.map((item) => (
                                <tr key={item.organization_id}>
                                  <td><strong>{item.organization_name}</strong></td>
                                  <td>{item.campaign_count} campaigns</td>
                                  <td>{item.donation_count} donations</td>
                                  <td>₹{Number(item.gross_amount).toLocaleString()}</td>
                                  <td style={{ color: '#F59E0B' }}>- ₹{Number(item.platform_fee).toLocaleString()}</td>
                                  <td><strong style={{ color: '#059669', fontSize: '0.98rem' }}>₹{Number(item.net_ngo_payout).toLocaleString()}</strong></td>
                                  <td>
                                    {item.org_razorpay_key ? (
                                      <code style={{ fontSize: '0.75rem' }}>{item.org_razorpay_key}</code>
                                    ) : (
                                      <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>System Default</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                              {(!breakdownData.ngoBreakdown || breakdownData.ngoBreakdown.length === 0) && (
                                <tr>
                                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-light)', padding: '16px' }}>No financial records available yet.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>

                        {/* Breakdown per Campaign Table */}
                        <div className="card">
                          <h3 style={{ marginBottom: '16px', color: 'var(--primary)' }}>🎯 Per-Campaign Financial Monitor</h3>
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th>Campaign Title</th>
                                <th>NGO Owner</th>
                                <th>Donations Count</th>
                                <th>Gross Raised</th>
                                <th>Platform Fee</th>
                                <th>Net Payout</th>
                                <th>Active Razorpay Key</th>
                              </tr>
                            </thead>
                            <tbody>
                              {breakdownData.campaignBreakdown?.map((item) => (
                                <tr key={item.campaign_id}>
                                  <td><strong>{item.campaign_title}</strong></td>
                                  <td>{item.organization_name}</td>
                                  <td>{item.donation_count} donors</td>
                                  <td>₹{Number(item.gross_amount).toLocaleString()}</td>
                                  <td style={{ color: '#F59E0B' }}>- ₹{Number(item.platform_fee).toLocaleString()}</td>
                                  <td><strong style={{ color: '#059669' }}>₹{Number(item.net_ngo_payout).toLocaleString()}</strong></td>
                                  <td>
                                    {item.campaign_razorpay_key ? (
                                      <code style={{ fontSize: '0.75rem', color: '#059669', background: '#ECFDF5', padding: '2px 6px', borderRadius: '4px' }}>
                                        🔑 {item.campaign_razorpay_key}
                                      </code>
                                    ) : (
                                      <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>NGO Default Key</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                              {(!breakdownData.campaignBreakdown || breakdownData.campaignBreakdown.length === 0) && (
                                <tr>
                                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-light)', padding: '16px' }}>No active campaign transactions yet.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 4. MASTER TRANSACTIONS LEDGER */}
                {activeSuperadminTab === 'transactions' && (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', paddingRight: '6px' }}>
                    <div className="page-header" style={{ marginBottom: '20px', flexShrink: 0 }}>
                      <div>
                        <h2>Global Transactions Ledger</h2>
                        <p style={{ color: 'var(--text-secondary)' }}>Global ledger monitoring contributions, settlement rails, and receipts.</p>
                      </div>
                    </div>

                    <div className="card">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Donor Name</th>
                            <th>Email Address</th>
                            <th>Amount</th>
                            <th>Gateway</th>
                            <th>Method</th>
                            <th style={{ textAlign: 'right' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {donations.map((d) => (
                            <tr key={d.id}>
                              <td><strong>{d.donorName}</strong></td>
                              <td>{d.donorEmail}</td>
                              <td>{d.currency} {Number(d.amount).toLocaleString()}</td>
                              <td><span style={{ textTransform: 'uppercase' }}>{d.paymentGateway}</span></td>
                              <td><span style={{ textTransform: 'uppercase' }}>{d.paymentMethod}</span></td>
                              <td>
                                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                  <button 
                                    onClick={() => setSelectedDonationForModal(d)} 
                                    className="btn btn-secondary" 
                                    style={{ padding: '4px 8px', fontSize: '0.75rem', color: '#2563EB', borderColor: '#BFDBFE' }}
                                  >
                                    🔍 Full Razorpay Data
                                  </button>
                                  <button onClick={() => handleDeleteDonation(d.id)} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--error)' }}>Delete Log</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ========================================================
                    MODAL POPUPS (NGO CREATE / EDIT & CAMPAIGN CREATE / EDIT)
                    ======================================================== */}

                {/* NGO Create Modal */}
                {showAddNgoModal && (
                  <div className="modal-backdrop">
                    <div className="modal-container" style={{ maxWidth: '650px' }}>
                      <div className="modal-header">
                        <h3>Register New NGO Profile</h3>
                        <button onClick={() => setShowAddNgoModal(false)} style={{ border: 'none', background: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
                      </div>
                      <form onSubmit={(e) => { handleAddNGO(e); setShowAddNgoModal(false); }}>
                        <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                          <div className="form-group">
                            <label className="form-label">NGO Name</label>
                            <input type="text" className="form-input" value={newNgoName} onChange={(e) => setNewNgoName(e.target.value)} required placeholder="e.g. Hope Foundation" />
                          </div>
                          <div className="form-group">
                            <label className="form-label">URL Slug</label>
                            <input type="text" className="form-input" value={newNgoSlug} onChange={(e) => setNewNgoSlug(e.target.value)} required placeholder="hope-foundation" />
                          </div>
                          <div style={{ display: 'flex', gap: '12px' }}>
                            <div className="form-group" style={{ flex: 1 }}>
                              <label className="form-label">Country</label>
                              <select className="form-input" value={newNgoCountry} onChange={(e) => setNewNgoCountry(e.target.value)}>
                                <option value="IN">India (IN)</option>
                                <option value="US">United States (US)</option>
                                <option value="GB">United Kingdom (GB)</option>
                              </select>
                            </div>
                            <div className="form-group" style={{ flex: 1 }}>
                              <label className="form-label">Primary Currency</label>
                              <select className="form-input" value={newNgoCurrency} onChange={(e) => setNewNgoCurrency(e.target.value)}>
                                <option value="INR">INR (₹)</option>
                                <option value="USD">USD ($)</option>
                                <option value="GBP">GBP (£)</option>
                              </select>
                            </div>
                          </div>

                          {/* Superadmin Permissions Controls */}
                          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '12px' }}>
                            <h4 style={{ fontSize: '0.95rem', marginBottom: '12px', color: 'var(--primary)' }}>⚡ Superadmin Feature & Action Permissions</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.85rem' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                <input type="checkbox" checked={newNgoCanAccept} onChange={(e) => setNewNgoCanAccept(e.target.checked)} />
                                Allow Accepting Donations
                              </label>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                <input type="checkbox" checked={newNgoCan80g} onChange={(e) => setNewNgoCan80g(e.target.checked)} />
                                Allow 80G Tax Receipts
                              </label>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                <input type="checkbox" checked={newNgoCanExport} onChange={(e) => setNewNgoCanExport(e.target.checked)} />
                                Allow Data Exports
                              </label>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                <input type="checkbox" checked={newNgoCanAi} onChange={(e) => setNewNgoCanAi(e.target.checked)} />
                                Enable AI Analytics
                              </label>
                            </div>
                            <div className="form-group" style={{ marginTop: '12px' }}>
                              <label className="form-label">Platform Fee Rate (%)</label>
                              <input type="number" step="0.1" className="form-input" value={newNgoFeePercent} onChange={(e) => setNewNgoFeePercent(parseFloat(e.target.value) || 0)} />
                            </div>
                          </div>

                          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '12px' }}>
                            <h4 style={{ fontSize: '0.95rem', marginBottom: '12px', color: 'var(--primary)' }}>🔑 NGO-Level Razorpay Gateway Keys</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              <input type="text" placeholder="Razorpay Key ID (rzp_test_...)" className="form-input" value={newNgoRazorpayKeyId} onChange={(e) => setNewNgoRazorpayKeyId(e.target.value)} />
                              <input type="password" placeholder="Razorpay Key Secret" className="form-input" value={newNgoRazorpayKeySecret} onChange={(e) => setNewNgoRazorpayKeySecret(e.target.value)} />
                            </div>
                          </div>
                        </div>
                        <div className="modal-footer">
                          <button type="button" onClick={() => setShowAddNgoModal(false)} className="btn btn-secondary">Cancel</button>
                          <button type="submit" className="btn btn-primary">Create NGO Profile</button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {/* NGO Edit Modal */}
                {editingNgoId && (
                  <div className="modal-backdrop">
                    <div className="modal-container" style={{ maxWidth: '650px' }}>
                      <div className="modal-header">
                        <h3>Edit NGO Permissions & Keys</h3>
                        <button onClick={() => setEditingNgoId(null)} style={{ border: 'none', background: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
                      </div>
                      <form onSubmit={(e) => { handleUpdateNGO(e); setEditingNgoId(null); }}>
                        <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                          <div className="form-group">
                            <label className="form-label">NGO Name</label>
                            <input type="text" className="form-input" value={editNgoName} onChange={(e) => setEditNgoName(e.target.value)} required />
                          </div>
                          <div className="form-group">
                            <label className="form-label">URL Slug</label>
                            <input type="text" className="form-input" value={editNgoSlug} onChange={(e) => setEditNgoSlug(e.target.value)} required />
                          </div>
                          <div style={{ display: 'flex', gap: '12px' }}>
                            <div className="form-group" style={{ flex: 1 }}>
                              <label className="form-label">Country</label>
                              <select className="form-input" value={editNgoCountry} onChange={(e) => setEditNgoCountry(e.target.value)}>
                                <option value="IN">India (IN)</option>
                                <option value="US">United States (US)</option>
                                <option value="GB">United Kingdom (GB)</option>
                              </select>
                            </div>
                            <div className="form-group" style={{ flex: 1 }}>
                              <label className="form-label">Primary Currency</label>
                              <select className="form-input" value={editNgoCurrency} onChange={(e) => setEditNgoCurrency(e.target.value)}>
                                <option value="INR">INR (₹)</option>
                                <option value="USD">USD ($)</option>
                                <option value="GBP">GBP (£)</option>
                              </select>
                            </div>
                          </div>
                          <div className="form-group">
                            <label className="form-label">Account Status</label>
                            <select className="form-input" value={editNgoStatus} onChange={(e) => setEditNgoStatus(e.target.value)}>
                              <option value="active">Active</option>
                              <option value="suspended">Suspended</option>
                            </select>
                          </div>

                          {/* Superadmin Action Permissions */}
                          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '12px' }}>
                            <h4 style={{ fontSize: '0.95rem', marginBottom: '12px', color: 'var(--primary)' }}>⚡ Superadmin Feature & Action Permissions</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.85rem' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                <input type="checkbox" checked={editNgoCanAccept} onChange={(e) => setEditNgoCanAccept(e.target.checked)} />
                                Allow Accepting Donations
                              </label>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                <input type="checkbox" checked={editNgoCan80g} onChange={(e) => setEditNgoCan80g(e.target.checked)} />
                                Allow 80G Tax Receipts
                              </label>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                <input type="checkbox" checked={editNgoCanExport} onChange={(e) => setEditNgoCanExport(e.target.checked)} />
                                Allow Data Exports
                              </label>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                <input type="checkbox" checked={editNgoCanAi} onChange={(e) => setEditNgoCanAi(e.target.checked)} />
                                Enable AI Analytics
                              </label>
                            </div>
                            <div className="form-group" style={{ marginTop: '12px' }}>
                              <label className="form-label">Platform Fee Rate (%)</label>
                              <input type="number" step="0.1" className="form-input" value={editNgoFeePercent} onChange={(e) => setEditNgoFeePercent(parseFloat(e.target.value) || 0)} />
                            </div>
                          </div>

                          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '12px' }}>
                            <h4 style={{ fontSize: '0.95rem', marginBottom: '12px', color: 'var(--primary)' }}>🔑 NGO-Level Razorpay Gateway Keys</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              <input type="text" placeholder="Razorpay Key ID" className="form-input" value={editNgoRazorpayKeyId} onChange={(e) => setEditNgoRazorpayKeyId(e.target.value)} />
                              <input type="password" placeholder="Razorpay Key Secret" className="form-input" value={editNgoRazorpayKeySecret} onChange={(e) => setEditNgoRazorpayKeySecret(e.target.value)} />
                            </div>
                          </div>
                        </div>
                        <div className="modal-footer">
                          <button type="button" onClick={() => setEditingNgoId(null)} className="btn btn-secondary">Cancel</button>
                          <button type="submit" className="btn btn-primary">Save Changes</button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {/* Campaign Create Modal */}
                {showAddCampaignModal && (
                  <div className="modal-backdrop">
                    <div className="modal-container" style={{ maxWidth: '600px' }}>
                      <div className="modal-header">
                        <h3>Create New Campaign</h3>
                        <button onClick={() => setShowAddCampaignModal(false)} style={{ border: 'none', background: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
                      </div>
                      <form onSubmit={(e) => { handleAddCampaign(e); setShowAddCampaignModal(false); }}>
                        <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                          {organizations.length === 0 ? (
                            <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', padding: '16px', borderRadius: 'var(--radius-md)', marginBottom: '16px', color: '#991B1B' }}>
                              <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                ⚠️ NGO Organization Required
                              </div>
                              <p style={{ margin: '0 0 12px 0', fontSize: '0.84rem', lineHeight: 1.4 }}>
                                Every campaign MUST be assigned to an NGO organization. No NGO profiles exist in the database yet. Please register or assign an NGO profile first.
                              </p>
                              <button 
                                type="button" 
                                onClick={() => { setShowAddCampaignModal(false); setShowAddNgoModal(true); }}
                                className="btn btn-primary"
                                style={{ width: '100%', padding: '8px 14px', fontSize: '0.85rem' }}
                              >
                                🏢 Register New NGO Profile First
                              </button>
                            </div>
                          ) : (
                            <div className="form-group">
                              <label className="form-label">Target NGO Organization (Required)</label>
                              <select className="form-input" value={newCampOrgId} onChange={(e) => setNewCampOrgId(e.target.value)} required>
                                <option value="">Select Target NGO...</option>
                                {organizations.map(o => (
                                  <option key={o.id} value={o.id}>{o.name}</option>
                                ))}
                              </select>
                            </div>
                          )}
                          <div className="form-group">
                            <label className="form-label">Campaign Title</label>
                            <input type="text" className="form-input" value={newCampTitle} onChange={(e) => setNewCampTitle(e.target.value)} required placeholder="e.g. Clean Water Fund" />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Campaign Slug</label>
                            <input type="text" className="form-input" value={newCampSlug} onChange={(e) => setNewCampSlug(e.target.value)} required placeholder="clean-water" />
                          </div>
                          <div className="form-group">
                            <label className="form-label">🌐 External NGO Landing Page URL</label>
                            <input type="url" className="form-input" value={newCampLandingPageUrl} onChange={(e) => setNewCampLandingPageUrl(e.target.value)} placeholder="https://wateraid.org/clean-water-fund" />
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>The custom domain landing page URL hosted by the NGO.</span>
                          </div>
                          <div className="form-group">
                            <label className="form-label">Goal Target Amount (INR)</label>
                            <input type="number" className="form-input" value={newCampGoalAmount} onChange={(e) => setNewCampGoalAmount(Number(e.target.value) || 0)} required />
                          </div>

                          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '12px' }}>
                            <h4 style={{ fontSize: '0.95rem', marginBottom: '12px', color: 'var(--primary)' }}>⚡ Campaign Permissions & Config</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.85rem' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                <input type="checkbox" checked={newCampAllowAnon} onChange={(e) => setNewCampAllowAnon(e.target.checked)} />
                                Allow Anonymous Donations
                              </label>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                <input type="checkbox" checked={newCampTaxEnabled} onChange={(e) => setNewCampTaxEnabled(e.target.checked)} />
                                80G Tax Exemption Receipt
                              </label>
                            </div>
                          </div>

                          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '12px' }}>
                            <h4 style={{ fontSize: '0.95rem', marginBottom: '12px', color: 'var(--primary)' }}>🔑 Campaign-Specific Razorpay Gateway Keys (Optional)</h4>
                            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                              Provide specific Razorpay keys to route all donations received on this specific campaign to a designated account.
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              <input type="text" placeholder="Campaign Razorpay Key ID (rzp_test_...)" className="form-input" value={newCampRazorpayKeyId} onChange={(e) => setNewCampRazorpayKeyId(e.target.value)} />
                              <input type="password" placeholder="Campaign Razorpay Key Secret" className="form-input" value={newCampRazorpayKeySecret} onChange={(e) => setNewCampRazorpayKeySecret(e.target.value)} />
                            </div>
                          </div>
                        </div>
                        <div className="modal-footer">
                          <button type="button" onClick={() => setShowAddCampaignModal(false)} className="btn btn-secondary">Cancel</button>
                          <button type="submit" className="btn btn-primary">Create Campaign</button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {/* Campaign Edit Modal */}
                {editingCampId && (
                  <div className="modal-backdrop">
                    <div className="modal-container" style={{ maxWidth: '600px' }}>
                      <div className="modal-header">
                        <h3>Edit Campaign Keys, API Key & Permissions</h3>
                        <button onClick={() => setEditingCampId(null)} style={{ border: 'none', background: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
                      </div>
                      <form onSubmit={(e) => { handleUpdateCampaign(e); setEditingCampId(null); }}>
                        <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                          <div className="form-group">
                            <label className="form-label">Campaign Title</label>
                            <input type="text" className="form-input" value={editCampTitle} onChange={(e) => setEditCampTitle(e.target.value)} required />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Campaign Slug</label>
                            <input type="text" className="form-input" value={editCampSlug} onChange={(e) => setEditCampSlug(e.target.value)} required />
                          </div>
                          <div className="form-group">
                            <label className="form-label">🌐 External NGO Landing Page URL</label>
                            <input type="url" className="form-input" value={editCampLandingPageUrl} onChange={(e) => setEditCampLandingPageUrl(e.target.value)} placeholder="https://wateraid.org/clean-water-fund" />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Goal Target Amount (INR)</label>
                            <input type="number" className="form-input" value={editCampGoalAmount} onChange={(e) => setEditCampGoalAmount(Number(e.target.value) || 0)} required />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Campaign Status</label>
                            <select className="form-input" value={editCampActive ? 'true' : 'false'} onChange={(e) => setEditCampActive(e.target.value === 'true')}>
                              <option value="true">Active</option>
                              <option value="false">Inactive</option>
                            </select>
                          </div>

                          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '12px' }}>
                            <h4 style={{ fontSize: '0.95rem', marginBottom: '12px', color: 'var(--primary)' }}>⚡ Campaign Permissions & Config</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.85rem' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                <input type="checkbox" checked={editCampAllowAnon} onChange={(e) => setEditCampAllowAnon(e.target.checked)} />
                                Allow Anonymous Donations
                              </label>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                <input type="checkbox" checked={editCampTaxEnabled} onChange={(e) => setEditCampTaxEnabled(e.target.checked)} />
                                80G Tax Exemption Receipt
                              </label>
                            </div>
                          </div>

                          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '12px' }}>
                            <h4 style={{ fontSize: '0.95rem', marginBottom: '12px', color: 'var(--primary)' }}>🔑 Campaign-Specific Razorpay Gateway Keys</h4>
                            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                              Donations on this campaign will prioritize this Razorpay account over the NGO organization account.
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              <input type="text" placeholder="Campaign Razorpay Key ID" className="form-input" value={editCampRazorpayKeyId} onChange={(e) => setEditCampRazorpayKeyId(e.target.value)} />
                              <input type="password" placeholder="Campaign Razorpay Key Secret" className="form-input" value={editCampRazorpayKeySecret} onChange={(e) => setEditCampRazorpayKeySecret(e.target.value)} />
                            </div>
                          </div>
                        </div>
                        <div className="modal-footer">
                          <button type="button" onClick={() => setEditingCampId(null)} className="btn btn-secondary">Cancel</button>
                          <button type="submit" className="btn btn-primary">Save Changes</button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {/* 5. SYSTEM SETTINGS SUBTAB */}
                {activeSuperadminTab === 'settings' && (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', paddingRight: '6px' }}>
                    <div className="page-header" style={{ marginBottom: '20px', flexShrink: 0 }}>
                      <div>
                        <h2>System settings & Integrations</h2>
                        <p style={{ color: 'var(--text-secondary)' }}>Configure global payment gateways and AI engine credentials.</p>
                      </div>
                    </div>

                    <div className="card" style={{ maxWidth: '650px', padding: '32px' }}>
                      <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        
                        <div>
                          <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', color: 'var(--primary)', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                            💳 Razorpay Gateways Configuration
                          </h3>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div className="form-group">
                              <label className="form-label">Razorpay Key ID</label>
                              <input 
                                type="text" 
                                placeholder="key_test_..." 
                                className="form-input" 
                                style={{ width: '100%' }}
                                value={sysRazorpayId} 
                                onChange={(e) => setSysRazorpayId(e.target.value)} 
                              />
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '4px' }}>Used for domestic INR donation routing checkout overlays.</span>
                            </div>
                            <div className="form-group">
                              <label className="form-label">Razorpay Key Secret</label>
                              <div style={{ position: 'relative' }}>
                                <input 
                                  type={showRazorpaySecret ? "text" : "password"} 
                                  placeholder="••••••••••••••••" 
                                  className="form-input" 
                                  value={sysRazorpaySecret} 
                                  onChange={(e) => setSysRazorpaySecret(e.target.value)} 
                                  style={{ width: '100%', paddingRight: '40px' }}
                                />
                                <button 
                                  type="button" 
                                  onClick={() => setShowRazorpaySecret(!showRazorpaySecret)} 
                                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.1rem', padding: 0, outline: 'none' }}
                                >
                                  {showRazorpaySecret ? '👁️' : '🙈'}
                                </button>
                              </div>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '4px' }}>Verification secret to authenticate webhook hashes securely.</span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', color: 'var(--primary)', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                            🤖 AI Models API Keys
                          </h3>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div className="form-group">
                              <label className="form-label">Gemini API Key</label>
                              <input 
                                type="text" 
                                placeholder="AIzaSy..." 
                                className="form-input" 
                                style={{ width: '100%' }}
                                value={sysGeminiKey} 
                                onChange={(e) => setSysGeminiKey(e.target.value)} 
                              />
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '4px' }}>Powers the real-time tax benefits chat assistant on donation checkout pages.</span>
                            </div>
                            <div className="form-group">
                              <label className="form-label">OpenAI API Key</label>
                              <div style={{ position: 'relative' }}>
                                <input 
                                  type={showOpenaiKey ? "text" : "password"} 
                                  placeholder="sk-proj-..." 
                                  className="form-input" 
                                  value={sysOpenaiKey} 
                                  onChange={(e) => setSysOpenaiKey(e.target.value)} 
                                  style={{ width: '100%', paddingRight: '40px' }}
                                />
                                <button 
                                  type="button" 
                                  onClick={() => setShowOpenaiKey(!showOpenaiKey)} 
                                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.1rem', padding: 0, outline: 'none' }}
                                >
                                  {showOpenaiKey ? '👁️' : '🙈'}
                                </button>
                              </div>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '4px' }}>Powers the dynamic Thank-You email copilot inside NGO admin dashboards.</span>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '20px', marginTop: '8px' }}>
                          <button type="submit" className="btn btn-primary" style={{ padding: '10px 24px' }}>
                            Save System Configurations
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

              </div>
            )}


          </main>
        </div>
      )}

      {realtimeNotification && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          backgroundColor: '#0F766E',
          color: '#ffffff',
          padding: '16px 24px',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid #14B8A6',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{ fontSize: '1.25rem' }}>🔔</div>
          <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{realtimeNotification}</div>
          <button 
            onClick={() => setRealtimeNotification(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.7)',
              cursor: 'pointer',
              fontSize: '1.2rem',
              marginLeft: '8px',
              outline: 'none',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            ✕
          </button>
        </div>
      )}
      {/* Razorpay Full Donor & Transaction Details Modal */}
      {selectedDonationForModal && (
        <div className="modal-backdrop">
          <div className="modal-container" style={{ maxWidth: '750px', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.4rem' }}>💳</span>
                <div>
                  <h3 style={{ margin: 0 }}>Razorpay Complete Donor & Transaction Payload</h3>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    Transaction ID: <code>{selectedDonationForModal.gatewayTransactionId || selectedDonationForModal.id}</code>
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedDonationForModal(null)} style={{ border: 'none', background: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
            </div>

            <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Donor Profile Section */}
              <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--background)', border: '1px solid var(--border)' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.92rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  👤 Client Donor Identity & Contact Details
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', fontSize: '0.84rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Donor Full Name</span>
                    <strong>{selectedDonationForModal.donorName}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Email Address</span>
                    <strong>{selectedDonationForModal.donorEmail}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Verified Phone / Contact Number</span>
                    <strong>{selectedDonationForModal.rawGatewayResponse?.contact || selectedDonationForModal.donorPhone || 'Not provided'}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>PAN / Tax ID (80G Compliance)</span>
                    <strong>{selectedDonationForModal.donorTaxId || 'Domestic Individual'}</strong>
                  </div>
                </div>
              </div>

              {/* Razorpay Gateway Payload Breakdown */}
              <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--background)', border: '1px solid var(--border)' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.92rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  📊 Razorpay Payment Metadata & Settlement Specs
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', fontSize: '0.84rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Razorpay Payment ID</span>
                    <code style={{ fontSize: '0.78rem', color: '#2563EB' }}>{selectedDonationForModal.rawGatewayResponse?.id || selectedDonationForModal.gatewayTransactionId || 'pay_test'}</code>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Razorpay Order ID</span>
                    <code style={{ fontSize: '0.78rem' }}>{selectedDonationForModal.rawGatewayResponse?.order_id || 'order_test'}</code>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Gross Amount Paid</span>
                    <strong style={{ color: '#059669', fontSize: '0.95rem' }}>{selectedDonationForModal.currency} {Number(selectedDonationForModal.amount).toLocaleString()}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Payment Gateway Method</span>
                    <span className="badge" style={{ backgroundColor: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE', textTransform: 'uppercase' }}>
                      {selectedDonationForModal.rawGatewayResponse?.method || selectedDonationForModal.paymentMethod || 'UPI'}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Bank / VPA / Card Ref</span>
                    <strong>
                      {selectedDonationForModal.rawGatewayResponse?.vpa || 
                       selectedDonationForModal.rawGatewayResponse?.bank || 
                       (selectedDonationForModal.rawGatewayResponse?.card ? `${selectedDonationForModal.rawGatewayResponse.card.network} **** ${selectedDonationForModal.rawGatewayResponse.card.last4}` : 'N/A')}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Bank UTR / RRN Reference</span>
                    <code>{selectedDonationForModal.rawGatewayResponse?.acquirer_data?.rrn || selectedDonationForModal.rawGatewayResponse?.acquirer_data?.bank_transaction_id || 'RRN-9841029412'}</code>
                  </div>
                </div>
              </div>

              {/* External NGO Landing Page Form Custom Data Payload */}
              {(selectedDonationForModal.custom_form_data || selectedDonationForModal.customFormData) && (
                <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    📦 Captured Client Details (External Form Inputs)
                  </h4>
                  <pre style={{ backgroundColor: '#0F172A', color: '#34D399', padding: '12px', borderRadius: '8px', fontSize: '0.78rem', overflowX: 'auto', margin: 0 }}>
                    {JSON.stringify(selectedDonationForModal.custom_form_data || selectedDonationForModal.customFormData, null, 2)}
                  </pre>
                </div>
              )}

              {/* JSON Inspector for Complete Raw Razorpay API Response */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <h4 style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-primary)' }}>🛠️ Raw Razorpay API Response Object (JSON)</h4>
                  <button 
                    onClick={() => handleSyncRazorpayDetails(selectedDonationForModal.id)} 
                    className="btn btn-secondary" 
                    style={{ padding: '4px 10px', fontSize: '0.75rem', color: '#2563EB', borderColor: '#2563EB' }}
                    disabled={isSyncingRazorpay}
                  >
                    {isSyncingRazorpay ? 'Syncing...' : '🔄 Live Fetch from Razorpay API'}
                  </button>
                </div>
                <pre style={{ backgroundColor: '#0F172A', color: '#38BDF8', padding: '14px', borderRadius: 'var(--radius-md)', fontSize: '0.75rem', overflowX: 'auto', maxHeight: '220px', border: '1px solid #1E293B', lineHeight: 1.4 }}>
                  {JSON.stringify(selectedDonationForModal.rawGatewayResponse || selectedDonationForModal, null, 2)}
                </pre>
              </div>
            </div>

            <div className="modal-footer" style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setSelectedDonationForModal(null)} className="btn btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Embed Code & Integration Snippet Modal */}
      {selectedCampForEmbedModal && (
        <div className="modal-backdrop">
          <div className="modal-container" style={{ maxWidth: '720px', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.4rem' }}>🔌</span>
                <div>
                  <h3 style={{ margin: 0 }}>External Landing Page API & Embed Integration</h3>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    Campaign: <strong>{selectedCampForEmbedModal.title}</strong> (<code>/{selectedCampForEmbedModal.slug}</code>)
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedCampForEmbedModal(null)} style={{ border: 'none', background: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
            </div>

            <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Credentials Box */}
              <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#1E40AF' }}>🔑 DanaPro API Key & Gateway Credentials</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.82rem' }}>
                  <div>
                    <span style={{ color: '#1E3A8A', fontWeight: 600 }}>DanaPro Campaign API Key: </span>
                    <code style={{ fontSize: '0.85rem', color: '#2563EB', background: '#DBEAFE', padding: '2px 8px', borderRadius: '4px' }}>
                      {selectedCampForEmbedModal.api_key || `dp_live_${selectedCampForEmbedModal.slug}_19283`}
                    </code>
                  </div>
                  <div>
                    <span style={{ color: '#1E3A8A', fontWeight: 600 }}>Configured Landing Page URL: </span>
                    <code>{selectedCampForEmbedModal.landing_page_url || 'Not set (will accept requests from any domain)'}</code>
                  </div>
                </div>
              </div>

              {/* Option A: JavaScript SDK Embed Code */}
              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: 'var(--primary)' }}>⚡ Option 1: 1-Line DanaPro JS Embed (Add to NGO Landing Page HTML)</h4>
                <pre style={{ backgroundColor: '#0F172A', color: '#38BDF8', padding: '14px', borderRadius: 'var(--radius-md)', fontSize: '0.78rem', overflowX: 'auto', margin: 0, lineHeight: 1.5 }}>
{`<!-- 1. Include Razorpay & DanaPro SDK -->
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script src="http://localhost:5000/api/v1/external/embed.js"></script>

<!-- 2. Call DanaPro.pay() on your Submit/Donate button click -->
<script>
  function handleDonateSubmit() {
    DanaPro.pay({
      apiKey: "${selectedCampForEmbedModal.api_key || 'dp_live_' + selectedCampForEmbedModal.slug}",
      amount: document.getElementById('donation_amount').value,
      currency: "INR",
      name: document.getElementById('donor_name').value,
      email: document.getElementById('donor_email').value,
      phone: document.getElementById('donor_phone').value,
      taxId: document.getElementById('donor_pan').value,
      customFormData: {
        address: document.getElementById('address')?.value || '',
        city: document.getElementById('city')?.value || '',
        comments: "Submitted from NGO landing page"
      },
      onSuccess: function(res) {
        alert("Payment Completed! 80G Receipt Ref: " + res.receiptNumber);
      }
    });
  }
</script>`}
                </pre>
              </div>

              {/* Option B: REST API Endpoint Spec */}
              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: 'var(--primary)' }}>📡 Option 2: REST API Backend Payload (`POST /api/v1/external/donations/initiate`)</h4>
                <pre style={{ backgroundColor: '#0F172A', color: '#34D399', padding: '14px', borderRadius: 'var(--radius-md)', fontSize: '0.78rem', overflowX: 'auto', margin: 0, lineHeight: 1.5 }}>
{`POST http://localhost:5000/api/v1/external/donations/initiate
Headers:
  x-danapro-api-key: "${selectedCampForEmbedModal.api_key || 'dp_live_' + selectedCampForEmbedModal.slug}"
  Content-Type: application/json

Body:
{
  "api_key": "${selectedCampForEmbedModal.api_key || 'dp_live_' + selectedCampForEmbedModal.slug}",
  "amount": 1000,
  "currency": "INR",
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+919876543210",
  "taxId": "ABCDE1234F",
  "customFormData": {
    "address": "123 Marine Drive",
    "city": "Mumbai",
    "pincode": "400001",
    "campaignSlug": "${selectedCampForEmbedModal.slug}"
  }
}`}
                </pre>
              </div>
            </div>

            <div className="modal-footer" style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setSelectedCampForEmbedModal(null)} className="btn btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
