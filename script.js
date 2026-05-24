// Wait for the page to fully load
document.addEventListener('DOMContentLoaded', function() {
  const continueBtn = document.getElementById('continueBtn');
  const emailInput = document.getElementById('email');
  const amountInput = document.getElementById('amount');
  const methodCards = Array.from(document.querySelectorAll('.method-card[data-method]'));
  let selectedMethod = 'bank';

  function setSelectedMethod(method) {
    selectedMethod = method || 'bank';
    methodCards.forEach(btn => btn.classList.toggle('active', btn.dataset.method === selectedMethod));
    localStorage.setItem('paymentMethod', selectedMethod);
  }

  methodCards.forEach(btn => {
    btn.addEventListener('click', () => setSelectedMethod(btn.dataset.method));
  });
  setSelectedMethod(localStorage.getItem('paymentMethod') || 'bank');
  
  continueBtn.addEventListener('click', function() {
    const email = emailInput.value.trim();
    const amount = amountInput.value.trim();
    
    if (!email) {
      alert('Please enter your email address.');
      return;
    }
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      alert('Please enter a valid amount.');
      return;
    }
    if (!email.includes('@')) {
      alert('Enter a valid email address.');
      return;
    }
    
      // Store data in localStorage for the modal flows
      localStorage.setItem('paymentEmail', email);
      localStorage.setItem('paymentAmount', amount);
      localStorage.setItem('paymentMethod', selectedMethod);
    
      // Open selected payment method
      if (selectedMethod === 'bank') showBankTransferModal();
      else showAltPaymentModal(selectedMethod);
  });
  
    // Modal helpers & bank/upload logic
    const bankModal = document.getElementById('bankTransferModal');
    const altModal = document.getElementById('altPaymentModal');
    const uploadModal = document.getElementById('uploadReceiptModal');
    const transferCard = document.getElementById('transferCard');
    const altPaymentCard = document.getElementById('altPaymentCard');
    const uploadCard = document.getElementById('uploadCard');
    let supabaseClient = null;

    function openModal(modal) {
      modal.setAttribute('aria-hidden','false');
      document.body.style.overflow = 'hidden';
    }
    function closeModal(modal) {
      modal.setAttribute('aria-hidden','true');
      document.body.style.overflow = '';
    }

    document.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal');
      if (modal) closeModal(modal);
    }));

    function ensureSupabaseLoaded(callback) {
      if (supabaseClient) return callback();
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.onload = () => {
        const { createClient } = window.supabase;
        supabaseClient = createClient(
          'https://orgjpigkatqazfqrlfsy.supabase.co',
          'sb_publishable__150-sgRl8uNszzXKH4_JA_R25xdYla'
        );
        callback();
      };
      script.onerror = () => {
        console.warn('Failed to load Supabase, continuing with defaults');
        callback();
      };
      document.head.appendChild(script);
    }

    function showBankTransferModal() {
      transferCard.innerHTML = '<div class="loading">Loading bank details...</div>';
      openModal(bankModal);
      ensureSupabaseLoaded(renderTransferPage);
    }

    const altPaymentConfig = {
      cashapp: {
        title: 'Cash App',
        logo: '💸',
        primaryLabel: 'Cash App tag',
        primaryValue: '$yourcashtag'
      },
      venmo: {
        title: 'Venmo',
        logo: '💳',
        primaryLabel: 'Venmo username',
        primaryValue: '@yourvenmo'
      },
      zelle: {
        title: 'Zelle',
        logo: '🏦',
        primaryLabel: 'Zelle recipient',
        primaryValue: 'you@example.com'
      }
    };

    function showAltPaymentModal(method) {
      const email = localStorage.getItem('paymentEmail') || '';
      const amount = localStorage.getItem('paymentAmount') || '0';
      const formattedAmount = parseFloat(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const cfg = altPaymentConfig[method] || { title: 'Payment option', logo: '💳', primaryLabel: 'Details', primaryValue: '' };

      altPaymentCard.innerHTML = '<div class="loading">Loading payment option...</div>';

      openModal(altModal);
      ensureSupabaseLoaded(() => renderAltPaymentPage(method, { email, formattedAmount, fallback: cfg }));
    }

    function renderAltPaymentPage(method, ctx) {
      const fallback = ctx.fallback || { title: 'Payment option', logo: '💳', primaryLabel: 'Details', primaryValue: '' };

      if (supabaseClient) {
        supabaseClient
          .from('payment_method_settings')
          .select('method, display_name, primary_label, primary_value, instructions, enabled')
          .eq('method', method)
          .maybeSingle()
          .then(({ data, error }) => {
            if (!error && data && data.enabled !== false) {
              buildAltPaymentHtml(ctx, {
                title: data.display_name || fallback.title,
                logo: fallback.logo,
                primaryLabel: data.primary_label || fallback.primaryLabel,
                primaryValue: data.primary_value || fallback.primaryValue,
                instructions: data.instructions || ''
              });
              return;
            }
            buildAltPaymentHtml(ctx, { ...fallback, instructions: '' });
          })
          .catch(() => buildAltPaymentHtml(ctx, { ...fallback, instructions: '' }));
      } else {
        buildAltPaymentHtml(ctx, { ...fallback, instructions: '' });
      }
    }

    function buildAltPaymentHtml(ctx, cfg) {
      altPaymentCard.innerHTML = `
        <h1>${cfg.logo} ${escapeHtml(cfg.title)}</h1>
        <div class="sub">Use the details below to complete your payment</div>

        <div class="detail-row">
          <span class="detail-label">Amount</span>
          <span class="detail-value" id="altAmountValue">${ctx.formattedAmount}</span>
          <span class="copy-icon" data-copy="altAmount">📋 Copy</span>
        </div>

        <div class="detail-row">
          <span class="detail-label">${escapeHtml(cfg.primaryLabel)}</span>
          <span class="detail-value" id="altPrimaryValue">${escapeHtml(cfg.primaryValue)}</span>
          <span class="copy-icon" data-copy="altPrimary">📋 Copy</span>
        </div>

        <div class="detail-row">
          <span class="detail-label">Email</span>
          <span class="detail-value" id="altEmailValue">${escapeHtml(ctx.email)}</span>
          <span class="copy-icon" data-copy="altEmail">📋 Copy</span>
        </div>

        ${cfg.instructions ? `<div class="note">${escapeHtml(cfg.instructions)}</div>` : ''}

        <button class="btn-transfer" id="afterAltTransferBtn">Click after transfer has been done</button>
        <div class="note">Upload your transfer receipt for verification.</div>
      `;

      altPaymentCard.querySelectorAll('.copy-icon').forEach(icon => {
        icon.addEventListener('click', () => {
          const type = icon.getAttribute('data-copy');
          let value = '';
          if (type === 'altAmount') value = document.getElementById('altAmountValue')?.innerText || '';
          else if (type === 'altPrimary') value = document.getElementById('altPrimaryValue')?.innerText || '';
          else if (type === 'altEmail') value = document.getElementById('altEmailValue')?.innerText || '';
          if (value) navigator.clipboard.writeText(value).then(() => alert('Copied!'));
        });
      });

      document.getElementById('afterAltTransferBtn').addEventListener('click', () => {
        closeModal(altModal);
        openModal(uploadModal);
      });
    }

    async function renderTransferPage() {
      const email = localStorage.getItem('paymentEmail');
      const amount = localStorage.getItem('paymentAmount') || '0';
      let bankDetails = {
        bank_name: 'Alipay',
        account_number: '4419731234',
        beneficiary: 'Alipay-(Tobi Bakare)',
        routing_number: '',
        home_address: '',
        bank_address: '',
        swift_code: ''
      };

      if (supabaseClient) {
        try {
          const selectCols = 'bank_name, account_number, beneficiary, routing_number, home_address, bank_address, swift_code';
          const orderCandidates = ['updated_at', 'created_at', 'id'];
          let row = null;

          for (const orderCol of orderCandidates) {
            const { data, error } = await supabaseClient
              .from('bank_settings')
              .select(selectCols)
              .order(orderCol, { ascending: false })
              .limit(1);
            if (error) {
              console.warn(`Unable to load bank settings (order by ${orderCol}):`, error);
              continue;
            }
            row = Array.isArray(data) ? (data[0] || null) : data;
            break;
          }

          if (!row) {
            const { data, error } = await supabaseClient
              .from('bank_settings')
              .select(selectCols)
              .limit(1);
            if (error) console.warn('Unable to load bank settings (no order):', error);
            row = Array.isArray(data) ? (data[0] || null) : data;
          }

          if (row) {
            const fields = ['bank_name', 'account_number', 'beneficiary', 'routing_number', 'home_address', 'bank_address', 'swift_code'];
            fields.forEach(field => {
              if (row[field] != null && row[field] !== '') {
                bankDetails[field] = row[field];
              }
            });
          }
        } catch (err) {
          console.warn('Bank settings query exception:', err);
        }

        buildTransferHtml(email, amount, bankDetails);
      } else {
        buildTransferHtml(email, amount, bankDetails);
      }
    }

    function buildTransferHtml(email, amount, bankDetails) {
      const formattedAmount = parseFloat(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      transferCard.innerHTML = `
        <h1>🏦 Bank Transfer</h1>
        <div class="sub">Transfer to the account below</div>
      
        <div class="timer-box">
          <div class="timer-label">Complete transfer before timer expires</div>
          <div class="timer" id="countdownDisplay">30:00</div>
        </div>
      
        <div class="detail-row">
          <span class="detail-label">Amount</span>
          <span class="detail-value" id="amountValue">${formattedAmount}</span>
          <span class="copy-icon" data-copy="amount">📋 Copy</span>
        </div>
      
        <div class="detail-row">
          <span class="detail-label">Bank Name</span>
          <span class="detail-value" id="bankNameValue">${escapeHtml(bankDetails.bank_name)}</span>
          <span class="copy-icon" data-copy="bankName">📋 Copy</span>
        </div>
      
        <div class="detail-row">
          <span class="detail-label">Account Number</span>
          <span class="detail-value" id="accountValue">${escapeHtml(bankDetails.account_number)}</span>
          <span class="copy-icon" data-copy="account">📋 Copy</span>
        </div>
      
        <div class="detail-row">
          <span class="detail-label">Beneficiary</span>
          <span class="detail-value" id="beneficiaryValue">${escapeHtml(bankDetails.beneficiary)}</span>
          <span class="copy-icon" data-copy="beneficiary">📋 Copy</span>
        </div>
      
        <div class="detail-row">
          <span class="detail-label">Routing Number</span>
          <span class="detail-value" id="routingValue">${escapeHtml(bankDetails.routing_number)}</span>
          <span class="copy-icon" data-copy="routing">📋 Copy</span>
        </div>
      
        <div class="detail-row">
          <span class="detail-label">Home Address</span>
          <span class="detail-value" id="homeAddressValue">${escapeHtml(bankDetails.home_address)}</span>
          <span class="copy-icon" data-copy="homeAddress">📋 Copy</span>
        </div>
      
        <div class="detail-row">
          <span class="detail-label">Bank Address</span>
          <span class="detail-value" id="bankAddressValue">${escapeHtml(bankDetails.bank_address)}</span>
          <span class="copy-icon" data-copy="bankAddress">📋 Copy</span>
        </div>
      
        <div class="detail-row">
          <span class="detail-label">SWIFT Code</span>
          <span class="detail-value" id="swiftValue">${escapeHtml(bankDetails.swift_code)}</span>
          <span class="copy-icon" data-copy="swift">📋 Copy</span>
        </div>
      
        <button class="btn-transfer" id="afterTransferBtn">✅ Click after transfer has been done</button>
        <div class="note">*Payment confirmation will be validated after receipt upload</div>
      `;

      // Start countdown timer (30 minutes)
      let timeLeft = 1800;
      const timerEl = document.getElementById('countdownDisplay');
      function updateTimerDisplay() {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerEl.textContent = `${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`;
        if (timeLeft <= 0) timerEl.textContent = 'Expired';
      }
      const interval = setInterval(() => {
        if (timeLeft <= 0) clearInterval(interval);
        else { timeLeft--; updateTimerDisplay(); }
      }, 1000);
      updateTimerDisplay();

      // Copy functionality
      transferCard.querySelectorAll('.copy-icon').forEach(icon => {
        icon.addEventListener('click', () => {
          const type = icon.getAttribute('data-copy');
          let value = '';
          if (type === 'amount') value = document.getElementById('amountValue')?.innerText || '';
          else if (type === 'bankName') value = document.getElementById('bankNameValue')?.innerText || '';
          else if (type === 'account') value = document.getElementById('accountValue')?.innerText || '';
          else if (type === 'beneficiary') value = document.getElementById('beneficiaryValue')?.innerText || '';
          else if (type === 'routing') value = document.getElementById('routingValue')?.innerText || '';
          else if (type === 'homeAddress') value = document.getElementById('homeAddressValue')?.innerText || '';
          else if (type === 'bankAddress') value = document.getElementById('bankAddressValue')?.innerText || '';
          else if (type === 'swift') value = document.getElementById('swiftValue')?.innerText || '';
          if (value) navigator.clipboard.writeText(value).then(() => alert(`${type} copied!`));
        });
      });

      // after transfer button -> open upload modal
      document.getElementById('afterTransferBtn').addEventListener('click', () => {
        openModal(uploadModal);
      });
    }

    function escapeHtml(str) {
      if (!str) return '';
      return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
      });
    }

    // Upload modal logic
    (function setupUploadModal(){
      const dropzone = document.getElementById('modalDropzone');
      const fileInput = document.getElementById('modalFileInput');
      const previewContainer = document.getElementById('modalPreviewContainer');
      const submitBtn = document.getElementById('modalSubmitReceiptBtn');
      const statusDiv = document.getElementById('modalUploadStatus');
      let selectedFile = null;

      dropzone.addEventListener('click', () => fileInput.click());

      dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.style.borderColor = 'var(--primary)'; });
      dropzone.addEventListener('dragleave', () => { dropzone.style.borderColor = ''; });
      dropzone.addEventListener('drop', (e) => { e.preventDefault(); const files = e.dataTransfer.files; if (files.length) handleFile(files[0]); });
      fileInput.addEventListener('change', (e) => { if (e.target.files.length) handleFile(e.target.files[0]); });

      function handleFile(file) {
        if (!file.type.startsWith('image/')) { alert('Only images are allowed'); return; }
        if (file.size > 5 * 1024 * 1024) { alert('File size must be less than 5MB'); return; }
        selectedFile = file;
        const reader = new FileReader();
        reader.onload = (ev) => { previewContainer.innerHTML = `<img src="${ev.target.result}" class="preview-img" alt="preview">`; };
        reader.readAsDataURL(file);
      }

      submitBtn.addEventListener('click', async () => {
        if (!selectedFile) { alert('Please select a receipt image first.'); return; }
        if (!supabaseClient) { alert('Please wait, connecting to payment service...'); return; }
        statusDiv.innerHTML = 'Uploading receipt...'; statusDiv.className = 'status';
        try {
          const email = localStorage.getItem('paymentEmail');
          const amount = localStorage.getItem('paymentAmount');
          const fileExt = selectedFile.name.split('.').pop();
          const fileName = `${Date.now()}_${Math.random().toString(36).substring(2,8)}.${fileExt}`;
          const filePath = `public/${fileName}`;
          const { data: uploadData, error: uploadError } = await supabaseClient.storage.from('payment_receipts').upload(filePath, selectedFile);
          if (uploadError) throw new Error(uploadError.message);
          const { data: publicUrlData } = supabaseClient.storage.from('payment_receipts').getPublicUrl(filePath);
          const imageUrl = publicUrlData.publicUrl;
          const method = localStorage.getItem('paymentMethod') || 'bank';
          const { error: insertError } = await supabaseClient.from('payment_transactions').insert([{ email: email, amount: parseFloat(amount), payment_method: method, receipt_url: imageUrl, status: 'pending' }]);
          if (insertError) throw new Error(insertError.message);
          statusDiv.innerHTML = '✅ Receipt uploaded successfully. Confirmation will be sent to your email. This page will close in 3 seconds...';
          statusDiv.className = 'status success';
          setTimeout(() => {
            closeModal(uploadModal);
            closeModal(bankModal);

            // Best-effort: browsers usually only allow closing tabs that were opened by script.
            try { window.close(); } catch (_) {}

            // Fallback: show a clean completion screen when closing is blocked.
            document.body.innerHTML = `
              <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#ffffff;">
                <div style="max-width:560px;width:100%;background:#ffffff;border:1px solid #eef2f6;border-radius:24px;padding:24px;box-shadow:0 20px 35px -12px rgba(0, 0, 0, 0.08);text-align:center;">
                  <div style="font-size:40px;line-height:1;margin-bottom:10px;">✅</div>
                  <h2 style="font-size:22px;margin:0 0 8px;color:#0b2b3b;">Receipt submitted</h2>
                  <div style="color:#5e727f;font-size:14px;line-height:1.5;">Receipt uploaded successfully. Confirmation will be sent to your email.</div>
                  <div style="color:#5e727f;font-size:13px;line-height:1.5;margin-top:8px;">If this tab didn’t close automatically, you can close it now.</div>
                </div>
              </div>
            `;
          }, 5000);
        } catch (error) {
          statusDiv.innerHTML = `❌ Error: ${error.message}`; statusDiv.className = 'status error'; console.error(error);
        }
      });
    })();
});
