import React, { useState, useEffect } from 'react'
import { X, User } from 'lucide-react'
import '../App.css'

export function SettingsPage() {
    const [config, setConfig] = useState<any>({
        darkMode: true,
        confirmDelete: true,
        user: null
    });

    useEffect(() => {
        const electron = (window as any).electron;
        if (!electron) return;

        // Load initial config
        electron.getConfig().then((c: any) => setConfig(c));

        // Listen for updates
        const removeListener = electron.onConfigUpdated((newConfig: any) => {
            setConfig(newConfig);
        });
    }, []);

    const handleClose = () => {
        window.close();
    };

    const updateConfig = (key: string, value: any) => {
        const electron = (window as any).electron;
        if (electron) {
            const newConfig = { [key]: value };
            electron.saveConfig(newConfig);
            // Optimistic update
            setConfig({ ...config, ...newConfig });
        }
    };

    const handleSignIn = () => {
        (window as any).ipcRenderer?.send('open-onboarding');
        window.close(); // Close settings to focus on onboarding
    };

    const handleSignOut = () => {
        updateConfig('user', null);
        updateConfig('authToken', null);
        updateConfig('onboardingComplete', false); // Maybe reset this? Or just user.
    };

    return (
        <div className={`settings-page ${config.darkMode ? 'dark' : ''}`} style={{ backgroundColor: config.darkMode ? '#202020' : '#f0f0f0', color: config.darkMode ? 'white' : 'black', height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <div className="settings-header" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', WebkitAppRegion: 'drag' } as any}>
                <span style={{ fontSize: '18px', fontWeight: 500 }}>Settings</span>
                <button onClick={handleClose} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', WebkitAppRegion: 'no-drag' }}>
                    <X size={20} />
                </button>
            </div>

            <div className="settings-content" style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
                {/* Profile */}
                <div className="profile-section" style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '24px' }}>
                    <div className="avatar" style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#333', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {config.user && config.user.picture ? <img src={config.user.picture} alt="avatar" style={{ width: '100%', height: '100%' }} /> : <User size={24} color="#888" />}
                    </div>
                    <div>
                        {config.user ? (
                            <>
                                <div style={{ fontWeight: 500 }}>{config.user.name}</div>
                                <div style={{ fontSize: '13px', opacity: 0.7 }}>{config.user.email}</div>
                                <button onClick={handleSignOut} style={{ background: 'none', border: 'none', color: '#62b5bf', padding: 0, fontSize: '13px', cursor: 'pointer', marginTop: '4px' }}>Sign out</button>
                            </>
                        ) : (
                            <button onClick={handleSignIn} style={{ background: 'none', border: 'none', color: '#62b5bf', padding: 0, fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>Sign in with Google</button>
                        )}
                    </div>
                </div>

                <div className="section-title" style={{ fontSize: '16px', fontWeight: 500, marginBottom: '12px', opacity: 0.8 }}>General</div>

                <div className="setting-item" style={{ marginBottom: '16px' }}>
                    <div style={{ marginBottom: '8px' }}>Enable insights</div>
                    <label className="switch">
                        <input type="checkbox" defaultChecked />
                        <span className="slider round"></span>
                    </label>
                    <span style={{ marginLeft: '8px', fontSize: '13px' }}>On</span>
                </div>

                <div className="setting-item" style={{ marginBottom: '24px' }}>
                    <div style={{ marginBottom: '8px' }}>Confirm before deleting</div>
                    <label className="switch">
                        <input
                            type="checkbox"
                            checked={config.confirmDelete}
                            onChange={(e) => updateConfig('confirmDelete', e.target.checked)}
                        />
                        <span className="slider round"></span>
                    </label>
                    <span style={{ marginLeft: '8px', fontSize: '13px' }}>{config.confirmDelete ? 'On' : 'Off'}</span>
                </div>

                <div className="divider" style={{ height: '1px', backgroundColor: '#444', marginBottom: '20px' }}></div>

                <div className="section-title" style={{ fontSize: '16px', fontWeight: 500, marginBottom: '12px', opacity: 0.8 }}>Color</div>
                <div className="radio-group" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                            type="radio"
                            name="theme"
                            checked={!config.darkMode}
                            onChange={() => updateConfig('darkMode', false)}
                        /> Light
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                            type="radio"
                            name="theme"
                            checked={config.darkMode}
                            onChange={() => updateConfig('darkMode', true)}
                        /> Dark
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input type="radio" name="theme" disabled /> Use my Windows mode
                    </label>
                </div>

                <div className="divider" style={{ height: '1px', backgroundColor: '#444', marginBottom: '20px' }}></div>

                <div className="section-title" style={{ fontSize: '16px', fontWeight: 500, marginBottom: '12px', opacity: 0.8 }}>Help & feedback</div>
                <div className="link-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
                    <a href="#" style={{ color: '#62b5bf', textDecoration: 'none' }}>Sync now</a>
                    <a href="#" style={{ color: '#62b5bf', textDecoration: 'none' }}>Help</a>
                    <a href="#" style={{ color: '#62b5bf', textDecoration: 'none' }}>Share feedback</a>
                    <a href="#" style={{ color: '#62b5bf', textDecoration: 'none' }}>Rate us</a>
                </div>

                <div className="about-section" style={{ marginTop: '40px', fontSize: '12px', opacity: 0.5, paddingBottom: '20px' }}>
                    <div style={{ fontSize: '16px', marginBottom: '8px', opacity: 1 }}>About</div>
                    <div>Sticky Notes 6.1.4.0</div>
                    <div>© 2026 Ghost Notes. All rights reserved.</div>
                </div>
            </div>
        </div>
    )
}
