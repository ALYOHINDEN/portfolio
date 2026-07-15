const state = {
  language: localStorage.getItem("portfolio-language") || "ru",
  theme: localStorage.getItem("portfolio-theme") || "dark",
  ui: null,
  profile: null,
  workflow: null,
  timeline: null,
  skills: null,
  projects: null,
  emailHandler: null,
  carouselCleanup: null
};

const loadJson = async (path) => {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Could not load ${path}`);
  return response.json();
};

const getText = (path) =>
  path.split(".").reduce((value, key) => value?.[key], state.ui) ?? "";

const formatText = (template, values) =>
  Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, value),
    template
  );

const applyStaticTranslations = () => {
  document.documentElement.lang = state.language;
  document.documentElement.dataset.language = state.language;
  document.title = state.ui.metaTitle;
  document.querySelector("#meta-description").content = state.ui.metaDescription;

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = getText(element.dataset.i18n);
  });

  const prev = document.querySelector("#cases-prev");
  const next = document.querySelector("#cases-next");
  prev.setAttribute("aria-label", state.ui.previousCase);
  next.setAttribute("aria-label", state.ui.nextCase);

  document.querySelectorAll(".language-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.language === state.language);
  });
};

const renderProfile = () => {
  const profile = state.profile;
  document.querySelector("#availability").textContent = profile.availability;
  document.querySelector("#availability-meta").textContent = profile.availabilityMeta;
  document.querySelector("#profile-name").textContent = profile.name;
  document.querySelector("#profile-title").textContent = profile.title;
  document.querySelector("#profile-subtitle").textContent = profile.subtitle;
  document.querySelector("#profile-experience").textContent = profile.experience;
  document.querySelector("#footer-name").textContent = profile.name;

  const photo = document.querySelector("#profile-photo");
  photo.src = profile.photo;
  photo.alt = state.ui.photoAlt;

  document.querySelector("#about-text").innerHTML = profile.about
    .map((item) => `<p>${item}</p>`)
    .join("");

  document.querySelector("#domain-list").innerHTML = profile.domains
    .map((domain) => `<span class="domain-chip">${domain}</span>`)
    .join("");

  document.querySelector("#focus-list").innerHTML = profile.focus
    .map((item) => `<li>${item}</li>`)
    .join("");

  document.querySelector("#contact-telegram").href = profile.telegram;
  document.querySelector("#contact-phone").href =
    `tel:${profile.phone.replace(/[^+\d]/g, "")}`;

  setupEmailCopy(profile.email);
};

const renderWorkflow = () => {
  document.querySelector("#workflow-grid").innerHTML = state.workflow
    .map(
      (step) => `
        <article>
          <span>${step.number}</span>
          <h3>${step.title}</h3>
          <p>${step.text}</p>
        </article>
      `
    )
    .join("");
};

const renderSkills = () => {
  document.querySelector("#skills-grid").innerHTML = state.skills
    .map(
      (skill) => `
        <article class="card">
          <h3>${skill.title}</h3>
          <p>${skill.text}</p>
        </article>
      `
    )
    .join("");
};

const renderTimeline = () => {
  const items = state.timeline;
  const list = document.querySelector("#timeline-list");
  const detail = document.querySelector("#timeline-detail");

  const showDetails = (item) => {
    detail.innerHTML = `
      <small>${item.duration}</small>
      <h3>${item.company}</h3>
      <p class="role">${item.role}</p>
      <p class="stage">${item.stage}</p>
      <p class="development">${item.development}</p>

      <h4>${state.ui.contextHeading}</h4>
      <p>${item.context}</p>

      <h4>${state.ui.tasks}</h4>
      <ul>${item.tasks.map((task) => `<li>${task}</li>`).join("")}</ul>

      <h4>${state.ui.results}</h4>
      <ul>${item.results.map((result) => `<li>${result}</li>`).join("")}</ul>
    `;
  };

  list.innerHTML = items
    .map(
      (item, index) => `
        <button
          class="timeline-item ${index === 0 ? "is-active" : ""}"
          data-id="${item.id}"
          type="button"
        >
          <small>${item.duration}</small>
          <strong>${item.stage}</strong>
          <span>${item.company} · ${item.summary}</span>
        </button>
      `
    )
    .join("");

  showDetails(items[0]);

  list.onclick = (event) => {
    const button = event.target.closest(".timeline-item");
    if (!button) return;

    list.querySelectorAll(".timeline-item").forEach((item) => {
      item.classList.remove("is-active");
    });
    button.classList.add("is-active");

    const selected = items.find((item) => item.id === button.dataset.id);
    if (selected) showDetails(selected);
  };
};

const getVisibleCards = () => {
  if (window.innerWidth <= 760) return 1;
  if (window.innerWidth <= 980) return 2;
  return 3;
};

const renderProjects = () => {
  const track = document.querySelector("#projects-track");
  track.innerHTML = state.projects
    .map(
      (project) => `
        <article class="case-card">
          <span class="case-label">${state.ui.caseLabel}</span>
          <h3>${project.title}</h3>
          <p><strong>${state.ui.challenge}:</strong> ${project.challenge}</p>
          <ul>${project.actions.map((action) => `<li>${action}</li>`).join("")}</ul>
          <p class="result">${project.result}</p>
        </article>
      `
    )
    .join("");

  if (state.carouselCleanup) state.carouselCleanup();
  state.carouselCleanup = setupCasesCarousel(state.projects.length);
};

const setupCasesCarousel = (totalItems) => {
  const track = document.querySelector("#projects-track");
  const prev = document.querySelector("#cases-prev");
  const next = document.querySelector("#cases-next");
  const dots = document.querySelector("#carousel-dots");

  let index = 0;
  let visibleCards = getVisibleCards();

  const maxIndex = () => Math.max(0, totalItems - visibleCards);

  const buildDots = () => {
    dots.innerHTML = "";
    for (let dotIndex = 0; dotIndex <= maxIndex(); dotIndex += 1) {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = `carousel-dot ${dotIndex === index ? "is-active" : ""}`;
      dot.setAttribute(
        "aria-label",
        formatText(state.ui.carouselGroup, { number: dotIndex + 1 })
      );
      dot.onclick = () => {
        index = dotIndex;
        update();
      };
      dots.appendChild(dot);
    }
  };

  const update = () => {
    const firstCard = track.querySelector(".case-card");
    if (!firstCard) return;

    const gap = 20;
    const cardWidth = firstCard.getBoundingClientRect().width;
    track.style.transform = `translateX(-${index * (cardWidth + gap)}px)`;

    prev.disabled = index === 0;
    next.disabled = index >= maxIndex();

    dots.querySelectorAll(".carousel-dot").forEach((dot, dotIndex) => {
      dot.classList.toggle("is-active", dotIndex === index);
    });
  };

  const handlePrev = () => {
    index = Math.max(0, index - 1);
    update();
  };

  const handleNext = () => {
    index = Math.min(maxIndex(), index + 1);
    update();
  };

  const handleResize = () => {
    const nextVisibleCards = getVisibleCards();
    if (nextVisibleCards !== visibleCards) {
      visibleCards = nextVisibleCards;
      index = Math.min(index, maxIndex());
      buildDots();
    }
    update();
  };

  prev.addEventListener("click", handlePrev);
  next.addEventListener("click", handleNext);
  window.addEventListener("resize", handleResize);

  buildDots();
  requestAnimationFrame(update);

  return () => {
    prev.removeEventListener("click", handlePrev);
    next.removeEventListener("click", handleNext);
    window.removeEventListener("resize", handleResize);
  };
};

const showToast = (message) => {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");

  clearTimeout(showToast.timeoutId);
  showToast.timeoutId = setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 2800);
};

const copyWithFallback = (text) => {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();

  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Copy failed");
};

const setupEmailCopy = (email) => {
  const button = document.querySelector("#copy-email");

  if (state.emailHandler) {
    button.removeEventListener("click", state.emailHandler);
  }

  state.emailHandler = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(email);
      } else {
        copyWithFallback(email);
      }

      showToast(formatText(state.ui.emailCopied, { email }));
    } catch (error) {
      console.error(error);
      showToast(formatText(state.ui.emailCopyFailed, { email }));
    }
  };

  button.addEventListener("click", state.emailHandler);
};

const updateScrollState = () => {
  const links = [...document.querySelectorAll(".nav a")];
  const sections = links
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  const headerHeight = document.querySelector(".site-header").offsetHeight;
  const about = document.querySelector("#about");
  const backToTop = document.querySelector("#back-to-top");
  const marker = window.scrollY + headerHeight + 32;

  const inHero = marker < about.offsetTop;
  backToTop.classList.toggle("is-visible", !inHero);

  let currentId = null;

  if (!inHero) {
    const atPageBottom =
      window.scrollY + window.innerHeight >=
      document.documentElement.scrollHeight - 4;

    if (atPageBottom) {
      currentId = "contact";
    } else {
      for (const section of sections) {
        if (marker >= section.offsetTop) {
          currentId = section.id;
        }
      }
    }
  }

  links.forEach((link) => {
    link.classList.toggle(
      "is-active",
      currentId !== null && link.getAttribute("href") === `#${currentId}`
    );
  });
};

const setupScrollNavigation = () => {
  const backToTop = document.querySelector("#back-to-top");

  backToTop.onclick = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  window.addEventListener("scroll", updateScrollState, { passive: true });
  window.addEventListener("resize", updateScrollState);
  updateScrollState();
};

const applyTheme = () => {
  document.documentElement.dataset.theme = state.theme;
  localStorage.setItem("portfolio-theme", state.theme);

  const toggle = document.querySelector("#theme-toggle");
  const icon = toggle.querySelector(".theme-toggle__icon");

  const isDark = state.theme === "dark";
  icon.textContent = isDark ? "☀" : "☾";
  toggle.setAttribute(
    "aria-label",
    isDark ? state.ui.themeToLight : state.ui.themeToDark
  );
  toggle.title = isDark ? state.ui.themeToLight : state.ui.themeToDark;
};

const setupThemeToggle = () => {
  document.querySelector("#theme-toggle").onclick = () => {
    state.theme = state.theme === "dark" ? "light" : "dark";
    applyTheme();
  };
};

const loadLanguage = async (language) => {
  const base = `data/${language}`;

  const [ui, profile, workflow, timeline, skills, projects] = await Promise.all([
    loadJson(`${base}/ui.json`),
    loadJson(`${base}/profile.json`),
    loadJson(`${base}/workflow.json`),
    loadJson(`${base}/timeline.json`),
    loadJson(`${base}/skills.json`),
    loadJson(`${base}/projects.json`)
  ]);

  Object.assign(state, {
    language,
    ui,
    profile,
    workflow,
    timeline,
    skills,
    projects
  });

  localStorage.setItem("portfolio-language", language);

  applyStaticTranslations();
  renderProfile();
  renderWorkflow();
  renderTimeline();
  renderSkills();
  renderProjects();
  applyTheme();
  updateScrollState();
};

const setupLanguageSwitcher = () => {
  document.querySelectorAll(".language-button").forEach((button) => {
    button.onclick = async () => {
      if (button.dataset.language === state.language) return;
      await loadLanguage(button.dataset.language);
    };
  });
};

const init = async () => {
  try {
    setupThemeToggle();
    setupLanguageSwitcher();
    setupScrollNavigation();

    await loadLanguage(state.language);

    document.querySelector("#year").textContent = new Date().getFullYear();
  } catch (error) {
    console.error(error);
    document.body.insertAdjacentHTML(
      "afterbegin",
      `<div style="padding:12px;background:#7f1d1d;color:#fff;text-align:center">
        ${state.ui?.loadError || "Could not load site data."}
      </div>`
    );
  }
};

init();
