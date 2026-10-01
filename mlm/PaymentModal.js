// ==========================================
// 💳 PAYMENT MODAL - หน้าต่างชำระเงิน (React Component)
// ==========================================
const { useState, useEffect } = React;
const { X, CheckCircle, SearchIcon } = window; // ดึง Icon จากไฟล์เดิมมาใช้

const PaymentModal = ({ isOpen, onClose, totalAmountTHB, currentExchangeRate, onPaymentComplete }) => {
    // State สำหรับจัดการยอดเงิน
    const [cashAmountTHB, setCashAmountTHB] = useState('');
    const [qrAmountLAK, setQrAmountLAK] = useState(0);
    const [qrImageUrl, setQrImageUrl] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);

    // คำนวณยอดเงินกีบอัตโนมัติ เมื่อมีการพิมพ์ยอดเงินสดบาท
    useEffect(() => {
        const cash = Number(cashAmountTHB) || 0;
        const remainTHB = totalAmountTHB - cash;
        
        if (remainTHB > 0) {
            setQrAmountLAK(remainTHB * currentExchangeRate);
        } else {
            setQrAmountLAK(0);
        }
        setQrImageUrl(null); // รีเซ็ต QR ถ้ายอดเปลี่ยน
    }, [cashAmountTHB, totalAmountTHB, currentExchangeRate]);

    if (!isOpen) return null;

    const handleGenerateQR = async () => {
        setIsGenerating(true);
        // เรียกใช้ API จากไฟล์ paymentApi.js
        const qrUrl = await window.PaymentAPI.generateQR(qrAmountLAK, 'LAK', 'ORDER_TEST_001');
        setQrImageUrl(qrUrl);
        setIsGenerating(false);

        // จำลองการฟังเสียงเตือนเงินเข้า
        window.PaymentAPI.listenForPaymentSuccess('ORDER_TEST_001', (result) => {
            alert("ธนาคารแจ้งว่าได้รับเงินแล้ว!");
            handleConfirmPayment(); // ปิดบิลอัตโนมัติ
        });
    };

    const handleConfirmPayment = () => {
        // ส่งข้อมูลกลับไปที่หน้า Sales เพื่อบันทึกลง Database
        onPaymentComplete({
            payment_method_1: 'Cash',
            currency_1: 'THB',
            amount_1: Number(cashAmountTHB) || 0,
            payment_method_2: window.PAYMENT_CONFIG.ENABLE_BCEL_API ? 'BCEL_QR' : 'Transfer_Manual',
            currency_2: 'LAK',
            amount_2: qrAmountLAK,
            exchange_rate_used: currentExchangeRate
        });
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                    <X size={24} />
                </button>

                <h2 className="text-xl font-black text-slate-800 mb-4">💳 ชำระเงิน / Payment</h2>
                
                <div className="bg-slate-50 p-4 rounded-xl mb-4 border border-slate-200 text-center">
                    <p className="text-sm text-slate-500 font-bold">ยอดรวมที่ต้องชำระ (THB)</p>
                    <p className="text-3xl font-black text-blue-600">฿{totalAmountTHB.toLocaleString()}</p>
                    <p className="text-xs text-slate-400 mt-1">เรทวันนี้: 1 ฿ = {currentExchangeRate} ₭</p>
                </div>

                {window.PAYMENT_CONFIG.ENABLE_SPLIT_PAYMENT && (
                    <div className="space-y-4">
                        {/* ส่วนที่ 1: เงินสดไทย */}
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1">1. รับเงินสด (THB)</label>
                            <input 
                                type="number" 
                                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2 text-lg font-bold" 
                                placeholder="0" 
                                value={cashAmountTHB} 
                                onChange={(e) => setCashAmountTHB(e.target.value)} 
                            />
                        </div>

                        {/* ส่วนที่ 2: ยอดคงเหลือเป็นเงินกีบ */}
                        {qrAmountLAK > 0 && (
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                                <label className="block text-xs font-bold text-blue-700 mb-1">2. ยอดคงเหลือสแกนจ่าย (LAK)</label>
                                <p className="text-2xl font-black text-blue-800 mb-3">₭{qrAmountLAK.toLocaleString()}</p>
                                
                                {window.PAYMENT_CONFIG.ENABLE_BCEL_API ? (
                                    // ถ้าเปิด API โชว์ปุ่มสร้าง QR Code
                                    qrImageUrl ? (
                                        <div className="text-center">
                                            <img src={qrImageUrl} alt="QR Code" className="w-48 h-48 mx-auto rounded-xl border-4 border-white shadow-md mb-2" />
                                            <p className="text-xs text-blue-600 animate-pulse font-bold">รอการสแกนชำระเงิน...</p>
                                        </div>
                                    ) : (
                                        <button onClick={handleGenerateQR} disabled={isGenerating} className="w-full bg-blue-600 text-white font-bold py-2 rounded-xl">
                                            {isGenerating ? "กำลังสร้าง QR..." : "สร้าง QR Code รับเงินกีบ"}
                                        </button>
                                    )
                                ) : (
                                    // ถ้าปิด API ไว้ โชว์ปุ่มยืนยันธรรมดา
                                    <p className="text-xs text-slate-500">* ระบบ API ปิดอยู่ กรุณาตรวจสลิปด้วยตนเอง</p>
                                )}
                            </div>
                        )}
                    </div>
                )}

                <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end gap-3">
                    <button onClick={onClose} className="px-6 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl">ยกเลิก</button>
                    <button onClick={handleConfirmPayment} className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl flex items-center gap-2">
                        <CheckCircle size={18} /> ยืนยันปิดบิล
                    </button>
                </div>
            </div>
        </div>
    );
};

// Expose ออกไปให้ไฟล์อื่นเรียกใช้
window.PaymentModal = PaymentModal;