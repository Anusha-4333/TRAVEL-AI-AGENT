document.addEventListener('DOMContentLoaded', () => {
  const chatToggle = document.getElementById('chatToggle');
  const chatPanel = document.getElementById('chatPanel');
  const chatClose = document.getElementById('chatClose');
  const chatForm = document.getElementById('chatForm');
  const chatMessages = document.querySelector('.chat-messages');
  const planForm = document.querySelector('.plan-form');
  const navToggle = document.getElementById('navToggle');
  const siteNav = document.getElementById('siteNav');
  const navLinks = Array.from(document.querySelectorAll('.nav-links a'));
  const sections = Array.from(document.querySelectorAll('main section[id]'));

  const setActiveLink = (link) => {
    navLinks.forEach((item) => item.classList.toggle('active', item === link));
  };

  const updateActiveNav = () => {
    const scrollPos = window.scrollY + window.innerHeight / 4;
    let currentId = 'home';
    sections.forEach((section) => {
      if (section.offsetTop <= scrollPos) {
        currentId = section.id;
      }
    });
    const activeLink = document.querySelector(`.nav-links a[href="#${currentId}"]`);
    if (activeLink) setActiveLink(activeLink);
  };

  if (navToggle && siteNav) {
    navToggle.addEventListener('click', () => {
      const isOpen = siteNav.classList.toggle('open');
      navToggle.classList.toggle('open', isOpen);
      navToggle.setAttribute('aria-expanded', String(isOpen));
    });
  }

  navLinks.forEach((link) => {
    link.addEventListener('click', () => {
      if (siteNav && siteNav.classList.contains('open')) {
        siteNav.classList.remove('open');
      }
      if (navToggle) {
        navToggle.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      }
      setActiveLink(link);
    });
  });

  window.addEventListener('scroll', updateActiveNav, { passive: true });
  updateActiveNav();

  function appendMessage(text, who = 'bot') {
    const el = document.createElement('div');
    el.className = `chat-message ${who}`;
    el.textContent = text;
    chatMessages.appendChild(el);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  if (chatToggle) {
    chatToggle.addEventListener('click', () => {
      const isOpening = !chatPanel.classList.contains('open');
      chatPanel.classList.toggle('open');
      // Auto-focus input when panel opens (FIX: Ensure focus for typing)
      if (isOpening) {
        setTimeout(() => {
          const input = chatForm?.querySelector('input');
          if (input) input.focus();
        }, 100);
      }
    });
  }
  if (chatClose) chatClose.addEventListener('click', () => chatPanel.classList.remove('open'));

  function getLocalChatReply(message) {
    const text = message.toLowerCase();
    if (text.includes('flight')) {
      return 'I can help find flights. Do you prefer cheapest or fastest?';
    }
    if (text.includes('hotel') || text.includes('stay')) {
      return 'Tell me your preferred area and star rating and I will suggest options.';
    }
    if (text.includes('plan') || text.includes('itinerary')) {
      return 'Use the "Generate Plan" form and I will create a day-by-day plan.';
    }
    return `I heard: "${message}" — how can I assist further?`;
  }

  if (chatForm) {
    chatForm.dataset.bound = '1'; // Prevent duplicate binding from fallback script

    // Handle Enter key to send message (FIX: Ensure Enter key sends message)
    const chatInput = chatForm.querySelector('input');
    if (chatInput) {
      chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          chatForm.dispatchEvent(new Event('submit'));
        }
      });
    }

    chatForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const input = chatForm.querySelector('input');
      const value = input.value.trim();
      if (!value) return;
      appendMessage(value, 'user');
      input.value = '';

      const requestPayload = { message: value };
      console.log('Sending chat request', requestPayload);

      const typingEl = document.createElement('div');
      typingEl.className = 'chat-message bot typing';
      typingEl.textContent = 'Travel AI is typing...';
      chatMessages.appendChild(typingEl);
      chatMessages.scrollTop = chatMessages.scrollHeight;

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: value })
        });
        const data = await res.json();
        typingEl.remove();
        appendMessage(data.reply || getLocalChatReply(value), 'bot');
      } catch (err) {
        typingEl.remove();
        appendMessage(getLocalChatReply(value), 'bot');
      }
    });
  }

  if (planForm) {
    planForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const destField = planForm.querySelector('#destination');
      const daysField = planForm.querySelector('#days');
      const budgetField = planForm.querySelector('#budget');
      const payload = {
        destination: destField ? destField.value.trim() : '',
        days: daysField ? daysField.value.trim() : '1',
        budget: budgetField ? budgetField.value.trim() : ''
      };

      const existing = document.querySelector('.plan-results');
      if (existing) existing.remove();

      const results = document.createElement('div');
      results.className = 'plan-results glass-card';
      results.innerHTML = '<p>Generating plan…</p>';
      planForm.parentElement.appendChild(results);

      try {
        const res = await fetch('/api/generate-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const json = await res.json();

        if (!res.ok || json.error) {
          results.innerHTML = `<p>Failed to generate plan: ${json.error || res.statusText || 'Unknown error'}</p>`;
          return;
        }

        const destination = json.destination || payload.destination || 'Unknown destination';
        const daysValue = json.days || payload.days || '1';
        const budgetValue = json.budget || payload.budget || '';
        const parsedPlan = json.plan || null;
        const planText = json.plan_text || (typeof json.plan === 'string' ? json.plan : '');

        let html = `<h4>Trip plan for ${escapeHtml(destination)} — ${escapeHtml(String(daysValue))} day(s)</h4>`;
        if (budgetValue) {
          html += `<p>Budget: ${escapeHtml(budgetValue)}</p>`;
        }

        if (parsedPlan && typeof parsedPlan === 'object') {
          if (parsedPlan.overview) {
            html += `<p>${escapeHtml(parsedPlan.overview)}</p>`;
          }

          const itinerary = Array.isArray(parsedPlan.itinerary)
            ? parsedPlan.itinerary
            : Array.isArray(parsedPlan)
            ? parsedPlan
            : null;

          if (itinerary) {
            html += '<ol class="itinerary-list">';
            itinerary.forEach(item => {
              const title = item.day ? `Day ${item.day}` : (item.title || 'Day');
              const morning = item.morning || item.morning_activity || '';
              const afternoon = item.afternoon || item.afternoon_activity || '';
              const evening = item.evening || item.evening_activity || '';
              const foods = item.food_recommendations || item.foods || [];
              const cost = item.estimated_cost || item.cost || '';
              html += `<li><strong>${escapeHtml(title)}</strong><br/>`;
              if (morning) html += `Morning: ${escapeHtml(morning)}<br/>`;
              if (afternoon) html += `Afternoon: ${escapeHtml(afternoon)}<br/>`;
              if (evening) html += `Evening: ${escapeHtml(evening)}<br/>`;
              if (foods && foods.length) html += `Food: ${escapeHtml(foods.join(' • '))}<br/>`;
              if (cost) html += `<em>Est. $${escapeHtml(String(cost))}</em>`;
              html += `</li>`;
            });
            html += '</ol>';
          } else {
            html += `<pre class="plan-output">${escapeHtml(JSON.stringify(parsedPlan, null, 2))}</pre>`;
          }
        } else if (planText && planText.trim()) {
          html += `<pre class="plan-output">${escapeHtml(planText)}</pre>`;
        } else {
          html += '<p>No plan data returned.</p>';
        }

        html += '<div class="plan-actions"><button class="button button-secondary" id="savePlanBtn">Save Plan</button> <button class="button" id="exportPlanBtn">Export JSON</button> <button class="button" id="printPlanBtn">Print</button></div>';
        results.innerHTML = html;

        const saveBtn = results.querySelector('#savePlanBtn');
        if (saveBtn) {
          saveBtn.addEventListener('click', async () => {
            saveBtn.disabled = true;
            try {
              const payloadToSave = {
                destination: json.destination || payload.destination,
                days: json.days || payload.days,
                budget: json.budget || payload.budget,
                itinerary: json.plan || json.plan_text || json.plan || json.itinerary || json
              };

              const r = await fetch('/api/save-trip', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payloadToSave)
              });
              await r.json();
              showToast('Plan saved');
            } catch (e) {
              showToast('Save failed', true);
            } finally {
              saveBtn.disabled = false;
            }
          });
        }

        const exportBtn = results.querySelector('#exportPlanBtn');
        if (exportBtn) {
          exportBtn.addEventListener('click', () => {
            const exportData = json.plan || json.plan_text || json;
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${json.destination || 'plan'}.json`;
            a.click();
            URL.revokeObjectURL(url);
          });
        }

        const printBtn = results.querySelector('#printPlanBtn');
        if (printBtn) {
          printBtn.addEventListener('click', () => {
            const w = window.open('', '_blank');
            w.document.write('<html><head><title>Trip Plan</title></head><body>' + results.innerHTML + '</body></html>');
            w.document.close();
            w.print();
          });
        }
      } catch (err) {
        results.innerHTML = '<p>Failed to generate plan. Try again later.</p>';
      }
    });
  }

  const myTripsAnchor = document.querySelector('a[href="#my-trips"]');
  const tripsModal = document.getElementById('tripsModal');
  const tripsList = document.getElementById('tripsList');
  const tripsClose = document.getElementById('tripsClose');
  function showToast(msg, isError = false) {
    let t = document.querySelector('.toast');
    if (!t) {
      t = document.createElement('div');
      t.className = 'toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.background = isError ? 'rgba(220,80,80,0.95)' : 'linear-gradient(90deg,#4e98ff,#79d2ff)';
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
  }

  async function loadTrips() {
    tripsList.innerHTML = 'Loading...';
    try {
      const r = await fetch('/api/my-trips');
      const d = await r.json();
      const trips = d.trips || [];
      if (!trips.length) {
        tripsList.innerHTML = '<p>No saved trips yet.</p>';
        return;
      }
      tripsList.innerHTML = '';
      trips.forEach(t => {
        const item = document.createElement('div');
        item.className = 'trip-item glass-card';
        item.innerHTML = `<strong>${t.destination}</strong> • ${t.days} day(s) • ${t.budget} <div class="trip-actions"><button data-id="${t.id}" class="button small btn-view">View</button> <button data-id="${t.id}" class="button small btn-delete">Delete</button></div>`;
        tripsList.appendChild(item);
        item.querySelector('.btn-view').addEventListener('click', () => {
          const win = window.open('', '_blank');
          win.document.write('<pre>' + JSON.stringify(t.plan, null, 2) + '</pre>');
          win.document.close();
        });
        item.querySelector('.btn-delete').addEventListener('click', async (e) => {
          const id = e.target.dataset.id;
          await fetch('/api/delete-trip/' + id, { method: 'DELETE' });
          showToast('Deleted');
          loadTrips();
        });
      });
    } catch (err) {
      tripsList.innerHTML = '<p>Failed to load trips.</p>';
    }
  }

  if (myTripsAnchor) {
    myTripsAnchor.addEventListener('click', (e) => {
      e.preventDefault();
      tripsModal.setAttribute('aria-hidden', 'false');
      tripsModal.style.display = 'grid';
      loadTrips();
    });
  }
  if (tripsClose) tripsClose.addEventListener('click', () => { tripsModal.style.display = 'none'; tripsModal.setAttribute('aria-hidden','true'); });

  const serviceData = {
    itinerary: {
      title: 'Personal Itinerary Design',
      icon: '✈️',
      description: 'Customized travel plans tailored to user interests, budget, and travel style. Our AI algorithms create personalized day-by-day itineraries optimized for your preferences.',
      features: [
        'Day-wise customized itinerary',
        'Attraction recommendations based on preferences',
        'Restaurant and dining suggestions',
        'Local experiences and hidden gems',
        'Travel time optimization'
      ],
      benefits: [
        'Saves planning time significantly',
        'Personalized recommendations',
        'Better overall travel experience',
        'Avoids tourist traps'
      ],
      pricing: 'Starting from ₹999',
      idealFor: 'Solo travelers, couples, families'
    },
    bundles: {
      title: 'Flight & Hotel Bundles',
      icon: '🏨',
      description: 'AI-curated travel packages with optimized flight and accommodation options. Get the best combination of flights and hotels tailored to your needs and budget.',
      features: [
        'Flight comparison across airlines',
        'Hotel recommendations by rating and location',
        'Exclusive package discounts',
        'Luxury and budget options',
        'Flexible cancellation policies'
      ],
      benefits: [
        'Save money with package deals',
        'Simplified booking process',
        'Best-value combinations',
        'Time-saving comparisons'
      ],
      pricing: 'Starting from ₹2,999',
      idealFor: 'Business travelers, vacation planners'
    },
    group: {
      title: 'Group & Family Trips',
      icon: '👥',
      description: 'Smart planning for families and groups with collaborative scheduling. Coordinate with multiple travelers and manage group budgets efficiently.',
      features: [
        'Shared itineraries for all members',
        'Group budgeting tools',
        'Family-friendly attractions',
        'Transportation coordination',
        'Collaborative planning interface'
      ],
      benefits: [
        'Easier group management',
        'Reduced travel stress',
        'Better coordination',
        'Shared cost savings'
      ],
      pricing: 'Starting from ₹1,999',
      idealFor: 'Families, friends, corporate groups'
    },
    concierge: {
      title: '24/7 Concierge Support',
      icon: '🛎️',
      description: 'Round-the-clock travel assistance before and during your trips. Get instant support for any travel concerns with our dedicated concierge team.',
      features: [
        'Live 24/7 support via chat',
        'Emergency assistance anytime',
        'Booking modifications on demand',
        'Local recommendations and tips',
        'Reservation management'
      ],
      benefits: [
        'Peace of mind during travel',
        'Quick issue resolution',
        'Enhanced travel safety',
        'Professional travel guidance'
      ],
      pricing: 'Included in Premium Plans',
      idealFor: 'All travelers'
    }
  };

  const servicePopupOverlay = document.getElementById('servicePopupOverlay');
  const servicePopupModal = document.getElementById('servicePopupModal');
  const servicePopupClose = document.getElementById('servicePopupClose');
  const serviceCards = document.querySelectorAll('.service-card');

  function openServicePopup(serviceName) {
    const service = serviceData[serviceName];
    if (!service) return;

    document.getElementById('popupIcon').textContent = service.icon;
    document.getElementById('popupTitle').textContent = service.title;
    document.getElementById('popupDescription').textContent = service.description;
    document.getElementById('popupPricing').textContent = service.pricing;
    document.getElementById('popupIdealFor').textContent = service.idealFor;

    const featuresList = document.getElementById('popupFeatures');
    featuresList.innerHTML = '';
    service.features.forEach(feature => {
      const li = document.createElement('li');
      li.textContent = feature;
      featuresList.appendChild(li);
    });

    const benefitsList = document.getElementById('popupBenefits');
    benefitsList.innerHTML = '';
    service.benefits.forEach(benefit => {
      const li = document.createElement('li');
      li.textContent = benefit;
      benefitsList.appendChild(li);
    });

    const ctaBtn = document.getElementById('servicePopupCTA');
    ctaBtn.textContent = `Plan "${service.title}"`;
    ctaBtn.onclick = () => {
      document.getElementById('destination').focus();
      closeServicePopup();
    };

    servicePopupOverlay.classList.add('active');
    servicePopupModal.classList.add('active');
  }

  function closeServicePopup() {
    servicePopupOverlay.classList.remove('active');
    servicePopupModal.classList.remove('active');
  }

  serviceCards.forEach(card => {
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => {
      const serviceName = card.getAttribute('data-service');
      openServicePopup(serviceName);
    });
  });

  if (servicePopupClose) {
    servicePopupClose.addEventListener('click', closeServicePopup);
  }

  servicePopupOverlay.addEventListener('click', (e) => {
    if (e.target === servicePopupOverlay) {
      closeServicePopup();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && servicePopupModal.classList.contains('active')) {
      closeServicePopup();
    }
  });

  const featureData = {
    'ai-planning': {
      title: 'AI Powered Planning',
      icon: '🤖',
      description: 'Generate intelligent travel itineraries using AI based on destination, budget, interests, trip duration, and travel style.',
      features: [
        'Smart itinerary generation',
        'Personalized recommendations',
        'Activity scheduling',
        'Travel optimization',
        'Destination insights'
      ],
      benefits: [
        'Saves planning time',
        'Personalized experience',
        'Better trip organization'
      ]
    },
    'hotel-recs': {
      title: 'Hotel Recommendations',
      icon: '🛎️',
      description: 'Receive AI-powered accommodation suggestions tailored to your budget, location preference, and travel style.',
      features: [
        'Budget hotels',
        'Luxury stays',
        'Family accommodations',
        'Rating-based recommendations',
        'Location analysis'
      ],
      benefits: [
        'Better stay options',
        'Cost savings',
        'Personalized choices'
      ]
    },
    'budget': {
      title: 'Budget Management',
      icon: '📊',
      description: 'Track and optimize travel expenses with intelligent budget forecasting and spending analysis.',
      features: [
        'Expense estimation',
        'Daily budget tracking',
        'Cost comparison',
        'Travel expense reports',
        'Savings recommendations'
      ],
      benefits: [
        'Better financial planning',
        'Reduced overspending',
        'Transparent trip costs'
      ]
    },
    'weather': {
      title: 'Weather Insights',
      icon: '☁️',
      description: 'Get destination-specific weather forecasts and recommendations for every day of your journey.',
      features: [
        'Daily forecasts',
        'Climate information',
        'Packing suggestions',
        'Seasonal recommendations',
        'Weather alerts'
      ],
      benefits: [
        'Better trip preparation',
        'Reduced travel disruptions',
        'Improved experience'
      ]
    }
  };

  const featurePopupOverlay = document.getElementById('featurePopupOverlay');
  const featurePopupModal = document.getElementById('featurePopupModal');
  const featurePopupClose = document.getElementById('featurePopupClose');
  const featureCards = document.querySelectorAll('.feature-card');
  const featureLearnMoreBtn = document.getElementById('featureLearnMore');
  const featureStartPlanningBtn = document.getElementById('featureStartPlanning');

  function openFeaturePopup(featureName) {
    const feature = featureData[featureName];
    if (!feature) return;

    document.getElementById('featurePopupIcon').textContent = feature.icon;
    document.getElementById('featurePopupTitle').textContent = feature.title;
    document.getElementById('featurePopupDescription').textContent = feature.description;

    const featuresList = document.getElementById('featurePopupFeatures');
    featuresList.innerHTML = '';
    feature.features.forEach(item => {
      const li = document.createElement('li');
      li.textContent = item;
      featuresList.appendChild(li);
    });

    const benefitsList = document.getElementById('featurePopupBenefits');
    benefitsList.innerHTML = '';
    feature.benefits.forEach(benefit => {
      const li = document.createElement('li');
      li.textContent = benefit;
      benefitsList.appendChild(li);
    });

    featurePopupOverlay.classList.add('active');
    featurePopupModal.classList.add('active');
  }

  function closeFeaturePopup() {
    featurePopupOverlay.classList.remove('active');
    featurePopupModal.classList.remove('active');
  }

  featureCards.forEach(card => {
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => {
      const featureName = card.getAttribute('data-feature');
      openFeaturePopup(featureName);
    });
  });

  if (featurePopupClose) {
    featurePopupClose.addEventListener('click', closeFeaturePopup);
  }

  if (featureLearnMoreBtn) {
    featureLearnMoreBtn.addEventListener('click', () => {
      closeFeaturePopup();
      const servicesSection = document.getElementById('services');
      if (servicesSection) {
        servicesSection.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  if (featureStartPlanningBtn) {
    featureStartPlanningBtn.addEventListener('click', () => {
      closeFeaturePopup();
      const planSection = document.getElementById('plan');
      if (planSection) {
        planSection.scrollIntoView({ behavior: 'smooth' });
        const destInput = document.getElementById('destination');
        if (destInput) destInput.focus();
      }
    });
  }

  featurePopupOverlay.addEventListener('click', (e) => {
    if (e.target === featurePopupOverlay) {
      closeFeaturePopup();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && featurePopupModal.classList.contains('active')) {
      closeFeaturePopup();
    }
  });

  const contactForm = document.getElementById('contactForm');
  const detectLocationBtn = document.getElementById('detectLocationBtn');
  const contactLoading = document.getElementById('contactLoading');
  const contactPopupOverlay = document.getElementById('contactPopupOverlay');
  const contactPopupModal = document.getElementById('contactPopupModal');
  const contactPopupClose = document.getElementById('contactPopupClose');
  const contactPopupBtn = document.getElementById('contactPopupBtn');

  function showContactPopup(title, message, isSuccess = true) {
    document.getElementById('contactPopupTitle').textContent = title;
    document.getElementById('contactPopupMessage').textContent = message;
    document.getElementById('contactPopupIcon').textContent = isSuccess ? '✓' : '✕';
    document.getElementById('contactPopupIcon').style.color = isSuccess ? '#4ed34e' : '#ff6b6b';
    contactPopupOverlay.classList.add('active');
    contactPopupModal.classList.add('active');
  }

  function closeContactPopup() {
    contactPopupOverlay.classList.remove('active');
    contactPopupModal.classList.remove('active');
  }

  if (contactPopupClose) {
    contactPopupClose.addEventListener('click', closeContactPopup);
  }

  if (contactPopupBtn) {
    contactPopupBtn.addEventListener('click', closeContactPopup);
  }

  contactPopupOverlay.addEventListener('click', (e) => {
    if (e.target === contactPopupOverlay) {
      closeContactPopup();
    }
  });

  async function getLocationFromCoordinates(latitude, longitude) {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
      const data = await response.json();
      const address = data.address || {};
      return {
        city: address.city || address.town || address.village || 'Unknown',
        state: address.state || 'Unknown',
        country: address.country || 'Unknown',
        lat: latitude,
        lng: longitude
      };
    } catch (error) {
      console.error('Geolocation reverse lookup failed:', error);
      return null;
    }
  }

  async function detectLocation() {
    const locationDisplay = document.getElementById('locationDisplay');
    const locationText = document.getElementById('locationText');

    if (!navigator.geolocation) {
      locationText.textContent = 'Geolocation not supported';
      return;
    }

    detectLocationBtn.disabled = true;
    detectLocationBtn.textContent = '📍 Detecting...';

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const locationData = await getLocationFromCoordinates(latitude, longitude);

        if (locationData) {
          document.getElementById('contactLat').value = latitude;
          document.getElementById('contactLng').value = longitude;
          document.getElementById('contactCity').value = locationData.city;
          document.getElementById('contactState').value = locationData.state;
          document.getElementById('contactCountry').value = locationData.country;

          locationText.textContent = `${locationData.city}, ${locationData.state}, ${locationData.country}`;
          detectLocationBtn.textContent = '✓ Location Detected';
          detectLocationBtn.style.color = '#4ed34e';
        } else {
          locationText.textContent = 'Location detection failed';
          detectLocationBtn.textContent = '📍 Try Again';
        }

        detectLocationBtn.disabled = false;
      },
      (error) => {
        console.error('Geolocation error:', error);
        locationText.textContent = 'Permission denied or error occurred';
        detectLocationBtn.textContent = '📍 Try Again';
        detectLocationBtn.disabled = false;
      }
    );
  }

  if (detectLocationBtn) {
    detectLocationBtn.addEventListener('click', (e) => {
      e.preventDefault();
      detectLocation();
    });
  }

  console.log('✅ Contact form scripts loaded and ready');

  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = document.getElementById('contactName').value.trim();
      const email = document.getElementById('contactEmail').value.trim();
      const subject = document.getElementById('contactSubject').value.trim();
      const message = document.getElementById('contactMessage').value.trim();
      const lat = document.getElementById('contactLat').value;
      const lng = document.getElementById('contactLng').value;
      const city = document.getElementById('contactCity').value;
      const state = document.getElementById('contactState').value;
      const country = document.getElementById('contactCountry').value;

      if (!name || !email || !subject || !message) {
        showContactPopup('Validation Error', 'Please fill in all required fields.', false);
        return;
      }

      contactLoading.classList.add('show');
      document.getElementById('contactSubmitBtn').disabled = true;

      try {
        console.log('Submitting contact form to /api/contact', {name, email, subject, message});

        const response = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            email,
            subject,
            message,
            latitude: lat || null,
            longitude: lng || null,
            city: city || null,
            state: state || null,
            country: country || null
          })
        });

        console.log('API response status:', response.status, response.statusText);
        console.log('Response headers:', response.headers.get('content-type'));

        let result;
        try {
          result = await response.json();
          console.log('Parsed response:', result);
        } catch (parseError) {
          console.error('Failed to parse response as JSON:', parseError);
          const textContent = await response.text();
          console.error('Raw response:', textContent);
          showContactPopup(
            'Connection Error',
            `Server responded with invalid data (${response.status}). Please check your connection and try again.`,
            false
          );
          return;
        }

        if (response.ok && result.success) {
          console.log('Contact form submitted successfully');
          showContactPopup(
            'Message Sent!',
            'Thank you for reaching out. We have received your message and will get back to you shortly. A confirmation email has been sent to your inbox.',
            true
          );
          contactForm.reset();
          document.getElementById('locationText').textContent = '';
          detectLocationBtn.textContent = '📍 Detect Location';
          detectLocationBtn.style.color = '#63b8ff';
        } else {
          const errorMsg = result.error || result.message || 'Failed to send message. Please try again later.';
          console.error('Contact submission failed:', errorMsg);
          showContactPopup(
            'Send Failed',
            errorMsg,
            false
          );
        }
      } catch (error) {
        console.error('Contact form network error:', error);
        console.error('Error type:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);

        const errorMsg = error.message || 'Network connection failed. Please check your internet connection.';
        showContactPopup(
          'Connection Failed',
          `${errorMsg}. Make sure the server is running at http://localhost:5000`,
          false
        );
      } finally {
        contactLoading.classList.remove('show');
        document.getElementById('contactSubmitBtn').disabled = false;
      }
    });
  }
});