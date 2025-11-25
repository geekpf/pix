import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'react-qr-code';
import { Copy, CheckCircle, RefreshCw, Loader2, ShieldCheck, Wallet, ArrowRight, DollarSign } from 'lucide-react';
import { createBilling, checkBillingStatus } from './services/abacateService';
import { saveTransaction, updateTransactionStatus, getAbacateApiKey } from './services/supabaseService';
import { formatCPF, formatPhone, cleanString } from './utils/formatters';
import { CustomerData, AbacateBillingResponse } from './types';

const App: React.FC = () => {
  // Form State
  const [formData, setFormData] = useState<CustomerData>({
    name: '',
    email: '',
    phone: '',
    cpf: ''
  });
  const [amount, setAmount] = useState(''); // Stores formatted string like "R$ 10,00"
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Transaction State
  const [transaction, setTransaction] = useState<AbacateBillingResponse | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'PENDING' | 'PAID' | 'FAILED'>('PENDING');
  const [copied, setCopied] = useState(false);
  
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let formattedValue = value;

    if (name === 'cpf') formattedValue = formatCPF(value);
    if (name === 'phone') formattedValue = formatPhone(value);

    setFormData(prev => ({ ...prev, [name]: formattedValue }));
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    
    if (!value) {
      setAmount('');
      return;
    }
    
    // Convert to number (cents) then to currency string
    const numberValue = parseInt(value) / 100;
    const formatted = numberValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    setAmount(formatted);
  };

  const startPolling = (billingId: string, apiKey: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    
    let attempts = 0;
    const maxAttempts = 120; // 10 minutes (120 * 5s)

    pollIntervalRef.current = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        return;
      }

      try {
        const status = await checkBillingStatus(apiKey, billingId);
        
        if (status === 'PAID') {
          setPaymentStatus('PAID');
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          await updateTransactionStatus(billingId, 'PAID');
        } else if (status === 'CANCELED' || status === 'FAILED') {
          setPaymentStatus('FAILED');
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          await updateTransactionStatus(billingId, status);
        }
      } catch (e) {
        console.error("Polling error:", e);
      }
    }, 5000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Calculate cents from formatted string
    const amountCents = parseInt(amount.replace(/\D/g, '')) || 0;

    if (amountCents < 100) {
      setError("O valor mínimo é de R$ 1,00");
      return;
    }

    setIsLoading(true);

    try {
      // 1. Fetch Abacate Key from DB
      const abacateKey = await getAbacateApiKey();
      
      if (!abacateKey) {
        throw new Error("API Key do Abacate Pay não encontrada no Banco de Dados. Insira a chave na tabela 'app_config' via SQL.");
      }

      // 2. Create Billing
      const billing = await createBilling(abacateKey, formData, amountCents);
      setTransaction(billing);
      setPaymentStatus('PENDING');

      // 3. Save to Supabase
      await saveTransaction({
        customer_name: formData.name,
        customer_email: formData.email,
        customer_cpf: cleanString(formData.cpf),
        abacate_billing_id: billing.id,
        pix_code: billing.pix.code,
        pix_url: billing.url,
        amount: billing.amount,
        status: 'PENDING'
      });

      // 4. Start Polling
      startPolling(billing.id, abacateKey);

    } catch (err: any) {
      console.error(err);
      let msg = err.message;
      if (msg === 'Failed to fetch') msg = "Erro de conexão. Verifique se o Supabase está acessível.";
      if (msg.includes("Supabase not initialized")) msg = "Conecte ao Supabase primeiro.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (transaction?.pix.code) {
      navigator.clipboard.writeText(transaction.pix.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const resetForm = () => {
    setTransaction(null);
    setPaymentStatus('PENDING');
    setFormData({ name: '', email: '', phone: '', cpf: '' });
    setAmount('');
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 md:p-6 font-sans">
      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-8 items-start">
        
        {/* Left Side: Branding / Intro */}
        <div className="hidden md:flex flex-col justify-center h-full space-y-6 pt-10">
          <div className="flex items-center gap-3">
             <div className="w-12 h-12 bg-emerald-900 rounded-2xl flex items-center justify-center shadow-lg transform -rotate-6">
                <span className="text-2xl">🥑</span>
             </div>
             <h1 className="text-3xl font-bold text-slate-800">Abacate Pix</h1>
          </div>
          <p className="text-slate-600 text-lg leading-relaxed">
            Sistema de pagamentos seguro. As credenciais do provedor são gerenciadas diretamente pelo banco de dados.
          </p>
          <div className="flex flex-col gap-4 mt-4">
             <div className="flex items-center gap-3 text-slate-700">
                <ShieldCheck className="text-emerald-600" />
                <span>Credenciais Criptografadas</span>
             </div>
             <div className="flex items-center gap-3 text-slate-700">
                <RefreshCw className="text-emerald-600" />
                <span>Status de Pagamento Automático</span>
             </div>
             <div className="flex items-center gap-3 text-slate-700">
                <Wallet className="text-emerald-600" />
                <span>Integração Supabase + AbacatePay</span>
             </div>
          </div>
        </div>

        {/* Right Side: The Card */}
        <div className="w-full bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden relative">
          
          {!transaction ? (
            <div className="p-8">
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Novo Pagamento</h2>
                <p className="text-slate-500 text-sm">Gere um QR Code Pix instantaneamente.</p>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100 flex items-start gap-2">
                   <span className="font-bold">Erro:</span> {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                
                {/* Amount Input */}
                <div className="relative">
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1.5 ml-1">Valor do Pagamento</label>
                  <div className="relative">
                    <input
                      type="text"
                      name="amount"
                      required
                      value={amount}
                      onChange={handleAmountChange}
                      placeholder="R$ 0,00"
                      className="w-full pl-12 pr-4 py-4 bg-emerald-50 border border-emerald-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xl font-bold text-emerald-900 placeholder-emerald-300 transition-all"
                    />
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600">
                      <DollarSign size={24} />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1.5 ml-1">Nome Completo</label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Ex: João da Silva"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1.5 ml-1">E-mail</label>
                  <input
                    type="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="joao@exemplo.com"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-500 mb-1.5 ml-1">CPF</label>
                    <input
                      type="text"
                      name="cpf"
                      required
                      value={formData.cpf}
                      onChange={handleInputChange}
                      placeholder="000.000.000-00"
                      maxLength={14}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-500 mb-1.5 ml-1">Telefone</label>
                    <input
                      type="tel"
                      name="phone"
                      required
                      value={formData.phone}
                      onChange={handleInputChange}
                      placeholder="(11) 99999-9999"
                      maxLength={15}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-4 rounded-xl shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/40 transform active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isLoading ? <Loader2 className="animate-spin" /> : <>Gerar Pix <ArrowRight size={20} /></>}
                </button>
              </form>
            </div>
          ) : (
            <div className="p-8 flex flex-col items-center text-center h-full justify-center min-h-[500px]">
              
              {paymentStatus === 'PAID' ? (
                 <div className="flex flex-col items-center animate-in fade-in zoom-in duration-500">
                    <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
                      <CheckCircle className="w-12 h-12 text-emerald-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Pagamento Confirmado!</h2>
                    <p className="text-slate-500 mb-8">
                       O registro foi atualizado no banco de dados.
                    </p>
                    <button 
                      onClick={resetForm}
                      className="bg-slate-800 hover:bg-slate-900 text-white px-8 py-3 rounded-xl font-medium transition-all"
                    >
                      Novo Pagamento
                    </button>
                 </div>
              ) : (
                <>
                  <div className="mb-6">
                    <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase">
                      Aguardando Pagamento
                    </span>
                  </div>
                  
                  <div className="bg-white p-4 rounded-2xl border-2 border-dashed border-emerald-500 mb-6 shadow-sm">
                    <QRCode 
                      value={transaction.pix.code} 
                      size={200}
                      fgColor="#064e3b" // Emerald 900
                    />
                  </div>

                  <p className="text-sm text-slate-500 mb-2">Valor Total</p>
                  <p className="text-3xl font-bold text-slate-800 mb-6">R$ {(transaction.amount / 100).toFixed(2).replace('.', ',')}</p>

                  <div className="w-full bg-slate-50 p-4 rounded-xl mb-6 flex items-center justify-between border border-slate-200">
                     <div className="truncate text-xs text-slate-500 font-mono w-full mr-4 text-left">
                       {transaction.pix.code}
                     </div>
                     <button 
                      onClick={copyToClipboard}
                      className={`p-2 rounded-lg transition-colors flex-shrink-0 ${copied ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-slate-600 hover:bg-slate-200 shadow-sm border border-slate-200'}`}
                     >
                       {copied ? <CheckCircle size={20}/> : <Copy size={20} />}
                     </button>
                  </div>

                  <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
                    <Loader2 size={16} className="animate-spin" />
                    Verificando status automaticamente...
                  </div>
                  
                  <button 
                      onClick={resetForm}
                      className="mt-8 text-slate-400 hover:text-slate-600 text-sm hover:underline"
                  >
                    Cancelar
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Mobile Branding Footer */}
      <div className="md:hidden mt-8 text-center text-slate-400 text-sm">
        <p className="flex items-center justify-center gap-2">Powered by <span className="font-bold text-emerald-600">Abacate Pay</span></p>
      </div>
    </div>
  );
};

export default App;