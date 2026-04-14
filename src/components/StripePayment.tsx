import React, { useState } from 'react';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import { Loader2, AlertCircle } from 'lucide-react';

interface StripePaymentProps {
  clientSecret: string;
  onSuccess: () => void;
  onCancel: () => void;
  amount: number;
}

export default function StripePayment({ clientSecret, onSuccess, onCancel, amount }: StripePaymentProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) return;

    setLoading(true);
    setError(null);

    const { error: submitError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href,
      },
      redirect: 'if_required',
    });

    if (submitError) {
      setError(submitError.message || 'Payment failed');
      setLoading(false);
    } else {
      onSuccess();
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
        <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest mb-1">Amount to Pay</p>
        <p className="text-2xl font-black text-zinc-900 tracking-tight">₹{amount}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <PaymentElement />
        
        {error && (
          <div className="bg-red-50 text-red-500 p-4 rounded-xl flex items-center gap-3 border border-red-100">
            <AlertCircle className="w-5 h-5" />
            <p className="text-sm font-bold">{error}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 bg-zinc-100 text-zinc-600 py-4 rounded-2xl font-black text-sm hover:bg-zinc-200 transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!stripe || loading}
            className="flex-[2] bg-emerald-500 text-white py-4 rounded-2xl font-black text-lg shadow-lg shadow-emerald-200 hover:bg-emerald-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : (
              `Pay ₹${amount}`
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
