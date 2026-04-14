import React, { useEffect } from 'react';
import { useRazorpay } from 'react-razorpay';

interface RazorpayPaymentProps {
  orderId: string;
  amount: number;
  userData: {
    uid: string;
    fullName: string;
    phoneNumber: string;
  };
  onSuccess: () => void;
  onCancel: () => void;
}

export default function RazorpayPayment({ orderId, amount, userData, onSuccess, onCancel }: RazorpayPaymentProps) {
  const { Razorpay } = useRazorpay();

  useEffect(() => {
    const handlePayment = async () => {
      const options: any = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || '',
        amount: Math.round(amount * 100),
        currency: 'INR',
        name: 'GrandLuck Pro',
        description: 'Payment for GrandLuck Pro',
        order_id: orderId,
        handler: async (response: any) => {
          try {
            const verifyRes = await fetch('/api/razorpay/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            if (verifyRes.ok) {
              onSuccess();
            } else {
              alert('Payment verification failed');
              onCancel();
            }
          } catch (err) {
            console.error('Verification error:', err);
            alert('Error verifying payment');
            onCancel();
          }
        },
        prefill: {
          name: userData.fullName,
          contact: userData.phoneNumber,
        },
        theme: {
          color: '#10b981', // emerald-500
        },
        modal: {
          ondismiss: () => {
            onCancel();
          },
        },
      };

      const rzp = new Razorpay(options);
      rzp.open();
    };

    handlePayment();
  }, [Razorpay, orderId, amount, userData, onSuccess, onCancel]);

  return null;
}
