import { useState } from 'react'
import ghostNotesIcon from '../assets/Ghosts Notes.png'

const slides = [
    {
        title: "Ghosts Notes",
        subtitle: "Your notes. Your eyes only.",
        desc: "Private notes that stay invisible while you share your screen."
    },
    {
        title: "Write freely, anytime",
        subtitle: "",
        desc: "Take notes during meetings, interviews, or presentations without switching apps or breaking focus."
    },
    {
        title: "Invisible during screen sharing",
        subtitle: "Your audience sees a clean screen.",
        desc: "Only you can see your notes."
    },
    {
        title: "Present with confidence",
        subtitle: "Stay organized, focused, and in control.",
        desc: "Ghosts Notes works quietly in the background."
    }
];

export function OnboardingPage() {
    const [step, setStep] = useState(0);

    const handleNext = () => {
        if (step < slides.length - 1) {
            setStep(step + 1);
        }
    };

    const handleGoogleLogin = async () => {
        try {
            await (window as any).electron?.loginGoogle();
        } catch (error) {
            console.error("Login failed", error);
        }
    };

    const currentSlide = slides[step];

    return (
        <div className="onboarding-container">
            <div style={{ marginBottom: '20px' }}>
                <img src={ghostNotesIcon} alt="Ghost Notes" style={{ width: '120px', height: '120px', objectFit: 'contain' }} />
            </div>

            {/* Dots */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '30px' }}>
                {slides.map((_, i) => (
                    <div key={i} style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: i === step ? 'currentColor' : 'rgba(128,128,128,0.3)',
                        transition: 'background-color 0.3s'
                    }} />
                ))}
            </div>

            <div className="slide-content" style={{ maxWidth: '400px', minHeight: '150px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>{currentSlide.title}</h1>
                {currentSlide.subtitle && <h2 style={{ fontSize: '18px', fontWeight: 'normal', opacity: 0.8, marginBottom: '16px' }}>{currentSlide.subtitle}</h2>}
                <p style={{ fontSize: '15px', lineHeight: '1.5', opacity: 0.6, whiteSpace: 'pre-line' }}>{currentSlide.desc}</p>
            </div>

            <div style={{ marginTop: '60px' }}>
                {step < slides.length - 1 ? (
                    <button
                        onClick={handleNext}
                        style={{
                            padding: '12px 32px',
                            background: '#333',
                            color: 'white',
                            border: '1px solid #555',
                            borderRadius: '24px',
                            fontSize: '15px',
                            cursor: 'pointer',
                            transition: 'background 0.2s'
                        }}
                    >
                        Next
                    </button>
                ) : (
                    <button
                        onClick={handleGoogleLogin}
                        style={{
                            padding: '12px 24px',
                            background: '#ffffff',
                            color: '#333',
                            border: 'none',
                            borderRadius: '24px',
                            fontSize: '15px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px'
                        }}
                    >
                        {/* Google Icon SVG */}
                        <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                            <path d="M17.64 9.20455C17.64 8.56636 17.5827 7.95273 17.4764 7.36364H9V10.845H13.8436C13.635 11.97 13.0009 12.9232 12.0477 13.5614V15.8195H14.9564C16.6582 14.2527 17.64 11.9455 17.64 9.20455Z" fill="#4285F4" />
                            <path d="M9 18C11.43 18 13.4673 17.1941 14.9564 15.8195L12.0477 13.5614C11.2418 14.1014 10.2109 14.4205 9 14.4205C6.65591 14.4205 4.67182 12.8373 3.96409 10.71H0.957275V13.0418C2.43818 15.9832 5.48182 18 9 18Z" fill="#34A853" />
                            <path d="M3.96409 10.71C3.78409 10.17 3.68182 9.59318 3.68182 9C3.68182 8.40682 3.78409 7.83 3.96409 7.29V4.95818H0.957275C0.347727 6.17318 0 7.54773 0 9C0 10.4523 0.347727 11.8268 0.957275 13.0418L3.96409 10.71Z" fill="#FBBC05" />
                            <path d="M9 3.57955C10.3214 3.57955 11.5077 4.03364 12.4405 4.92545L14.9891 2.37682C13.4673 0.957273 11.43 0 9 0C5.48182 0 2.43818 2.01682 0.957275 4.95818L3.96409 7.29C4.67182 5.16273 6.65591 3.57955 9 3.57955Z" fill="#EA4335" />
                        </svg>
                        Sign in with Google
                    </button>
                )}
            </div>
        </div>
    )
}
