import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import './App.css';
import { generateWireguardKeys, generatePresharedKey } from './utils/crypto';
import { generateServerConfig, generateClientConfig } from './utils/wgConfig';
import { QRCodeCanvas } from 'qrcode.react';
import JSZip from 'jszip';

function App() {
  const { t, i18n } = useTranslation();

  // --- Server State ---
  const [server, setServer] = useState({
    privateKey: '',
    publicKey: '',
    listenPort: '51820',
    endpoint: 'vpn.example.com',
    subnet: '10.0.0.1/24',
    baseIp: '10.0.0', // Helper pre výpočet IP pro klienty
    globalAllowedIps: '0.0.0.0/0, ::/0',
    globalKeepalive: '25',
    globalUseDns: false,
    globalDns: '1.1.1.1',
    enableNat: false,
    natInterface: 'eth0',
    globalUseMtu: false,
    globalMtu: '1420'
  });

  // --- Clients State ---
  const [clients, setClients] = useState([]);
  const fileInputRef = useRef(null);
  
  // --- QR State ---
  const [qrModal, setQrModal] = useState({ isOpen: false, title: '', content: '' });

  const downloadQr = () => {
    const canvas = document.getElementById('qr-canvas');
    if (canvas) {
      const pngUrl = canvas.toDataURL('image/png').replace('image/png', 'image/octet-stream');
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = `qr-${qrModal.title}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  // Inicializační generování server klíče při prvním načtení
  useEffect(() => {
    handleGenerateServerKeys();
  }, []);

  const handleGenerateServerKeys = () => {
    const keys = generateWireguardKeys();
    setServer(prev => ({
      ...prev,
      privateKey: keys.privateKey,
      publicKey: keys.publicKey
    }));
  };

  const handleServerChange = (field, value) => {
    setServer(prev => ({
      ...prev,
      [field]: value
    }));
    // Pokud měníme Subnet, aktualizujme baseIp (zjednodušeně)
    if (field === 'subnet') {
      const match = value.match(/^(\d+\.\d+\.\d+)\./);
      if (match) {
        setServer(prev => ({ ...prev, baseIp: match[1] }));
      }
    }
    // Hromadná aktualizace pro klienty
    if (field === 'globalAllowedIps') {
      setClients(prev => prev.map(c => ({ ...c, routeAllowedIps: value })));
    }
    if (field === 'globalKeepalive') {
      setClients(prev => prev.map(c => ({ ...c, keepalive: value })));
    }
    if (field === 'globalUseDns') {
      setClients(prev => prev.map(c => ({ ...c, useDns: value })));
    }
    if (field === 'globalDns') {
      setClients(prev => prev.map(c => ({ ...c, dns: value })));
    }
    if (field === 'globalUseMtu') {
      setClients(prev => prev.map(c => ({ ...c, useMtu: value })));
    }
    if (field === 'globalMtu') {
      setClients(prev => prev.map(c => ({ ...c, mtu: value })));
    }
  };

  const addClient = () => {
    const keys = generateWireguardKeys();
    const psk = generatePresharedKey();
    
    // Zjisti další volnou IP
    let nextIpNum = 2; // Začít od .2 protože .1 je server
    if (clients.length > 0) {
      const maxIpNum = Math.max(...clients.map(c => {
         const lastOctet = parseInt(c.allowedIp.split('.').pop(), 10);
         return isNaN(lastOctet) ? 1 : lastOctet;
      }));
      nextIpNum = maxIpNum + 1;
    }

    const newClient = {
      id: Date.now().toString(),
      name: `Client-${clients.length + 1}`,
      privateKey: keys.privateKey,
      publicKey: keys.publicKey,
      presharedKey: psk,
      allowedIp: `${server.baseIp}.${nextIpNum}`,
      routeAllowedIps: server.globalAllowedIps || '0.0.0.0/0, ::/0',
      keepalive: server.globalKeepalive || '25',
      useDns: server.globalUseDns || false,
      dns: server.globalDns || '1.1.1.1',
      useMtu: server.globalUseMtu || false,
      mtu: server.globalMtu || '1420'
    };

    setClients([...clients, newClient]);
  };

  const updateClient = (id, field, value) => {
    setClients(clients.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const removeClient = (id) => {
    setClients(clients.filter(c => c.id !== id));
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const downloadConfig = (filename, content) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadAllZip = () => {
    const zip = new JSZip();
    
    // Add server config
    zip.file('wg0.conf', generateServerConfig(server, clients));
    
    // Add client configs
    clients.forEach(client => {
      zip.file(`${client.name}.conf`, generateClientConfig(client, server));
    });
    
    // Generate and download
    zip.generateAsync({ type: 'blob' }).then(function(content) {
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wg-configs-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  };

  const handleExport = () => {
    const data = { server, clients };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wg-config-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (data.server && typeof data.server === 'object') {
          setServer(data.server);
        }
        if (Array.isArray(data.clients)) {
          setClients(data.clients);
        }
      } catch (err) {
        alert(t('alerts.importError'));
        console.error(err);
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset, aby šel nahrát stejný soubor znovu
  };

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div className="app-container">
      <div className="lang-switcher" style={{ position: 'absolute', top: '1rem', right: '1rem', display: 'flex', gap: '0.5rem' }}>
        <button 
          className={i18n.language === 'cs' ? 'active' : ''}
          onClick={() => changeLanguage('cs')} 
        >
          CZ
        </button>
        <button 
          className={i18n.language.startsWith('en') ? 'active' : ''}
          onClick={() => changeLanguage('en')} 
        >
          EN
        </button>
      </div>

      <header className="header animate-fade-in">
        <h1>{t('header.title')}</h1>
        <p>{t('header.subtitle')}</p>
      </header>

      <div className="main-grid">
        {/* --- LEVÝ SLOUPEC: OVLÁDÁNÍ --- */}
        <div className="controls-column">
          
          <div className="glass-panel animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <div className="section-title">
              <h2>{t('server.title')}</h2>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  style={{ display: 'none' }} 
                  accept=".json" 
                  onChange={handleImport} 
                />
                <button 
                   type="button" 
                   className="action-btn" 
                   style={{ width: 'auto', padding: '0.4rem 0.6rem', marginTop: 0, fontSize: '1.2rem' }} 
                   onClick={() => fileInputRef.current?.click()}
                   title={t('actions.import')}
                >
                  📂
                </button>
                <button 
                   type="button" 
                   className="action-btn" 
                   style={{ width: 'auto', padding: '0.4rem 0.6rem', marginTop: 0, fontSize: '1.2rem' }} 
                   onClick={handleExport}
                   title={t('actions.export')}
                >
                  💾
                </button>
                <button 
                   type="button" 
                   className="action-btn" 
                   style={{ width: 'auto', padding: '0.4rem 0.6rem', marginTop: 0, fontSize: '1.2rem' }} 
                   onClick={handleGenerateServerKeys}
                   title={t('actions.regenerateKeys')}
                >
                  🔄
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>{t('server.privateKey')}</label>
              <input type="text" value={server.privateKey} readOnly />
            </div>

            <div className="form-group">
              <label>{t('server.publicKey')}</label>
              <input type="text" value={server.publicKey} readOnly />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>{t('server.listenPort')}</label>
                <input 
                  type="text" 
                  value={server.listenPort} 
                  onChange={(e) => handleServerChange('listenPort', e.target.value)} 
                />
              </div>
              <div className="form-group">
                <label>{t('server.subnet')}</label>
                <input 
                  type="text" 
                  value={server.subnet} 
                  onChange={(e) => handleServerChange('subnet', e.target.value)} 
                />
              </div>
            </div>

            <div className="form-group">
              <label>{t('server.endpoint')}</label>
              <input 
                type="text" 
                value={server.endpoint} 
                onChange={(e) => handleServerChange('endpoint', e.target.value)} 
                placeholder={t('server.endpointPlaceholder')}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>{t('server.globalAllowedIps')}</label>
                <input 
                  type="text" 
                  value={server.globalAllowedIps || ''} 
                  onChange={(e) => handleServerChange('globalAllowedIps', e.target.value)} 
                />
              </div>
              <div className="form-group">
                <label>{t('server.globalKeepalive')}</label>
                <input 
                  type="text" 
                  value={server.globalKeepalive || ''} 
                  onChange={(e) => handleServerChange('globalKeepalive', e.target.value)} 
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input 
                  type="checkbox" 
                  checked={server.globalUseDns || false} 
                  onChange={(e) => handleServerChange('globalUseDns', e.target.checked)} 
                  style={{ width: 'auto' }}
                />
                <label style={{ marginBottom: 0 }}>{t('server.enableDns')}</label>
              </div>
              <div className="form-group">
                <input 
                  type="text" 
                  value={server.globalDns || ''} 
                  onChange={(e) => handleServerChange('globalDns', e.target.value)} 
                  disabled={!server.globalUseDns}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input 
                  type="checkbox" 
                  checked={server.globalUseMtu || false} 
                  onChange={(e) => handleServerChange('globalUseMtu', e.target.checked)} 
                  style={{ width: 'auto' }}
                />
                <label style={{ marginBottom: 0 }}>{t('server.enableMtu')}</label>
              </div>
              <div className="form-group">
                <input 
                  type="text" 
                  value={server.globalMtu || ''} 
                  onChange={(e) => handleServerChange('globalMtu', e.target.value)} 
                  disabled={!server.globalUseMtu}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input 
                  type="checkbox" 
                  checked={server.enableNat || false} 
                  onChange={(e) => handleServerChange('enableNat', e.target.checked)} 
                  style={{ width: 'auto' }}
                />
                <label style={{ marginBottom: 0 }}>{t('server.enableNat')}</label>
              </div>
              <div className="form-group">
                <input 
                  type="text" 
                  value={server.natInterface || ''} 
                  onChange={(e) => handleServerChange('natInterface', e.target.value)} 
                  disabled={!server.enableNat}
                  placeholder={t('server.natInterfacePlaceholder')}
                />
              </div>
            </div>

            <button type="button" className="action-btn success" onClick={addClient} style={{ marginTop: '1.5rem' }}>
              {t('actions.addClient')}
            </button>
          </div>

          <div style={{ marginTop: '2rem' }}>
             {/* Klienti byli presunuti do praveho panelu */}
          </div>
        </div>

        {/* --- PRAVÝ SLOUPEC: VÝSLEDKY --- */}
        <div className="results-column">
          <div className="glass-panel animate-fade-in" style={{ animationDelay: '0.2s', alignSelf: 'flex-start' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ color: '#e2e8f0', margin: 0 }}>{t('results.title')}</h2>
              {clients.length > 0 && (
                <button type="button" className="action-btn success" style={{ width: 'auto', margin: 0, padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} onClick={handleDownloadAllZip}>
                  {t('actions.downloadZip')}
                </button>
              )}
            </div>

            <div className="config-container">
              <div className="config-header">
                <h4>{t('results.serverFallback')}</h4>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" className="copy-btn" onClick={() => downloadConfig('wg0.conf', generateServerConfig(server, clients))}>
                    {t('actions.download')}
                  </button>
                  <button type="button" className="copy-btn" onClick={() => copyToClipboard(generateServerConfig(server, clients))}>
                    {t('actions.copy')}
                  </button>
                </div>
              </div>
              <pre className="code-block">{generateServerConfig(server, clients)}</pre>
            </div>

            {clients.length === 0 && (
               <div className="empty-state" style={{ marginTop: '2rem' }}>
                  {t('results.emptyState')}
               </div>
            )}

            {clients.map((client) => (
              <div key={`conf-${client.id}`} className="config-container mb-6 animate-fade-in">
                <div className="config-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <input 
                       style={{ background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.2)', fontSize: '1.2rem', color: '#60a5fa', fontWeight: 'bold', width: '120px', padding: '0.2rem', margin: 0, outline: 'none' }}
                       value={client.name} 
                       onChange={(e) => updateClient(client.id, 'name', e.target.value)}
                    />
                    <span style={{ color: '#94a3b8', fontSize: '1.2rem', fontWeight: 'bold' }}>.conf</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button type="button" className="copy-btn" onClick={() => setQrModal({ isOpen: true, title: client.name, content: generateClientConfig(client, server) })}>
                      {t('actions.showQr')}
                    </button>
                    <button type="button" className="copy-btn" onClick={() => downloadConfig(`${client.name}.conf`, generateClientConfig(client, server))}>
                      {t('actions.download')}
                    </button>
                    <button type="button" className="copy-btn" onClick={() => copyToClipboard(generateClientConfig(client, server))}>
                      {t('actions.copy')}
                    </button>
                    <button type="button" className="copy-btn" style={{ borderColor: 'rgba(239,68,68,0.3)', color: '#fca5a5' }} onClick={() => removeClient(client.id)}>
                      {t('actions.remove')}
                    </button>
                  </div>
                </div>

                <div className="client-settings-panel" style={{ padding: '1rem', background: 'rgba(255, 255, 255, 0.015)', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', marginBottom: '1rem' }}>
                  <div className="form-row" style={{ gap: '1rem', marginBottom: '0.75rem' }}>
                     <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '0.75rem', opacity: 0.8 }}>{t('client.privateKey')}</label>
                        <input type="text" style={{ fontSize: '0.8rem', padding: '0.5rem' }} value={client.privateKey} readOnly/>
                     </div>
                     <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '0.75rem', opacity: 0.8 }}>{t('client.clientIp')}</label>
                        <input type="text" style={{ fontSize: '0.8rem', padding: '0.5rem' }} value={client.allowedIp} onChange={(e) => updateClient(client.id, 'allowedIp', e.target.value)}/>
                     </div>
                  </div>
                  <div className="form-row" style={{ gap: '1rem', marginBottom: '0.75rem' }}>
                     <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '0.75rem', opacity: 0.8 }}>{t('client.allowedIps')}</label>
                        <input type="text" style={{ fontSize: '0.8rem', padding: '0.5rem' }} value={client.routeAllowedIps || ''} onChange={(e) => updateClient(client.id, 'routeAllowedIps', e.target.value)}/>
                     </div>
                     <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '0.75rem', opacity: 0.8 }}>{t('client.keepalive')}</label>
                        <input type="text" style={{ fontSize: '0.8rem', padding: '0.5rem' }} value={client.keepalive || ''} onChange={(e) => updateClient(client.id, 'keepalive', e.target.value)}/>
                     </div>
                  </div>
                  <div className="form-row" style={{ gap: '1rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', flex: 1, alignItems: 'center' }}>
                        <input type="checkbox" style={{ width: 'auto', margin: 0 }} checked={client.useDns || false} onChange={(e) => updateClient(client.id, 'useDns', e.target.checked)}/>
                        <label style={{ fontSize: '0.75rem', marginBottom: 0, opacity: 0.8, whiteSpace: 'nowrap' }}>{t('client.dns')}</label>
                        <input type="text" style={{ fontSize: '0.8rem', padding: '0.5rem', width: '100%' }} value={client.dns || ''} onChange={(e) => updateClient(client.id, 'dns', e.target.value)} disabled={!client.useDns}/>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flex: 1, alignItems: 'center' }}>
                        <input type="checkbox" style={{ width: 'auto', margin: 0 }} checked={client.useMtu || false} onChange={(e) => updateClient(client.id, 'useMtu', e.target.checked)}/>
                        <label style={{ fontSize: '0.75rem', marginBottom: 0, opacity: 0.8, whiteSpace: 'nowrap' }}>{t('client.mtu')}</label>
                        <input type="text" style={{ fontSize: '0.8rem', padding: '0.5rem', width: '100%' }} value={client.mtu || ''} onChange={(e) => updateClient(client.id, 'mtu', e.target.value)} disabled={!client.useMtu} placeholder="1420"/>
                    </div>
                  </div>
                </div>

                <pre className="code-block" style={{ margin: '0 1rem 1rem 1rem' }}>{generateClientConfig(client, server)}</pre>
              </div>
            ))}

          </div>
        </div>
      </div>

      {qrModal.isOpen && (
        <div className="modal-overlay" onClick={() => setQrModal({ isOpen: false, title: '', content: '' })}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>{t('results.showingQr').replace('{{name}}', qrModal.title)}</h3>
            <div className="qr-wrapper">
              <QRCodeCanvas 
                id="qr-canvas"
                value={qrModal.content} 
                size={256} 
                level="M"
                includeMargin={false}
              />
            </div>
            <div className="modal-actions">
              <button className="action-btn success" onClick={downloadQr}>{t('actions.downloadPng')}</button>
              <button className="action-btn danger" onClick={() => setQrModal({ ...qrModal, isOpen: false })}>{t('actions.close')}</button>
            </div>
          </div>
        </div>
      )}

      <footer className="app-footer">
        <p>© {new Date().getFullYear()} {t('footer.createdBy')} <strong><a href="https://www.jurakit.cz/" target="_blank" rel="noopener noreferrer" className="footer-link">Zdeněk Jurák</a></strong></p>
      </footer>
    </div>
  );
}

export default App;
