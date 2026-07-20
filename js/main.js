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
  carouselCleanup: null,
  carouselController: null,
  lastTimelineTrigger: null
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

  document.querySelector("#focus-list").innerHTML = profile.focus
    .map((item) => `<li>${item}</li>`)
    .join("");

  document.querySelector("#domain-list").innerHTML = profile.domains
    .map((item) => `<li class="domain-chip">${item}</li>`)
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

const isMobileTimeline = () => window.matchMedia("(max-width: 760px)").matches;

const buildTimelineDetails = (item, titleId = "") => `
  <small>${item.duration}</small>
  <h3 ${titleId ? `id="${titleId}"` : ""}>${item.company}</h3>
  <p class="role">${item.role}</p>
  <p class="stage">${item.stage}</p>
  <p class="development">${item.development}</p>

  <h4>${state.ui.contextHeading}</h4>
  <p>${item.context}</p>

  <h4>${state.ui.tasks}</h4>
  <ul>${item.tasks.map((task) => `<li>${task}</li>`).join("")}</ul>

  <h4>${state.ui.results}</h4>
  <ul>${item.results.map((result) => `<li>${result}</li>`).join("")}</ul>
  ${item.caseId ? `<button class="timeline-case-link" type="button" data-case-id="${item.caseId}">${state.ui.viewCase}<span aria-hidden="true">→</span></button>` : ""}
`;

const closeTimelineModal = () => {
  const modal = document.querySelector("#timeline-modal");
  if (modal.hidden) return;

  modal.classList.remove("is-visible");
  document.body.classList.remove("modal-open");

  window.setTimeout(() => {
    modal.hidden = true;
    document.querySelector("#timeline-modal-content").innerHTML = "";
    const dialog = modal.querySelector(".timeline-modal__dialog");
    dialog.style.removeProperty("transform");
    dialog.style.removeProperty("transition");
    modal.querySelector(".timeline-modal__backdrop").style.removeProperty("opacity");
    state.lastTimelineTrigger?.focus?.({ preventScroll: true });
  }, 220);
};

const openTimelineModal = (item) => {
  const modal = document.querySelector("#timeline-modal");
  const content = document.querySelector("#timeline-modal-content");
  const backdrop = modal.querySelector(".timeline-modal__backdrop");

  content.innerHTML = buildTimelineDetails(item, "timeline-modal-title");
  backdrop.setAttribute("aria-label", state.ui.timelineDialogClose);
  modal.querySelector(".timeline-modal__dialog").setAttribute(
    "aria-label",
    state.ui.timelineDialogLabel
  );

  const dialog = modal.querySelector(".timeline-modal__dialog");
  dialog.setAttribute("tabindex", "-1");
  dialog.scrollTop = 0;
  content.scrollTop = 0;
  modal.hidden = false;
  document.body.classList.add("modal-open");
  requestAnimationFrame(() => {
    dialog.scrollTop = 0;
    modal.classList.add("is-visible");
    requestAnimationFrame(() => {
      dialog.scrollTop = 0;
      dialog.focus({ preventScroll: true });
    });
  });
};

const setupTimelineModal = () => {
  const modal = document.querySelector("#timeline-modal");

  modal.querySelectorAll("[data-timeline-close]").forEach((button) => {
    button.onclick = closeTimelineModal;
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) {
      closeTimelineModal();
    }
  });

  const dialog = modal.querySelector(".timeline-modal__dialog");
  const backdrop = modal.querySelector(".timeline-modal__backdrop");
  const dragZone = document.querySelector("#timeline-modal-drag-zone");
  let pointerId = null;
  let startY = 0;
  let deltaY = 0;

  dragZone.addEventListener("pointerdown", (event) => {
    if (!isMobileTimeline()) return;
    pointerId = event.pointerId;
    startY = event.clientY;
    deltaY = 0;
    dragZone.setPointerCapture?.(pointerId);
    dialog.style.transition = "none";
  });

  dragZone.addEventListener("pointermove", (event) => {
    if (event.pointerId !== pointerId) return;
    deltaY = Math.max(0, event.clientY - startY);
    dialog.style.transform = `translateY(${deltaY}px)`;
    backdrop.style.opacity = String(Math.max(0, 1 - deltaY / 360));
  });

  const finishSwipe = (event) => {
    if (event.pointerId !== pointerId) return;
    dragZone.releasePointerCapture?.(pointerId);
    pointerId = null;
    dialog.style.transition = "transform .22s ease";
    if (deltaY > 90) {
      closeTimelineModal();
    } else {
      dialog.style.transform = "translateY(0)";
      backdrop.style.opacity = "1";
    }
    deltaY = 0;
  };

  dragZone.addEventListener("pointerup", finishSwipe);
  dragZone.addEventListener("pointercancel", finishSwipe);
};

const renderTimeline = () => {
  const items = state.timeline;
  const list = document.querySelector("#timeline-list");
  const detail = document.querySelector("#timeline-detail");

  const showDesktopDetails = (item) => {
    detail.innerHTML = buildTimelineDetails(item);
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

  showDesktopDetails(items[0]);
  closeTimelineModal();

  list.onclick = (event) => {
    const button = event.target.closest(".timeline-item");
    if (!button) return;

    list.querySelectorAll(".timeline-item").forEach((item) => {
      item.classList.remove("is-active");
    });
    button.classList.add("is-active");

    const selected = items.find((item) => item.id === button.dataset.id);
    if (!selected) return;
    state.lastTimelineTrigger = button;

    if (isMobileTimeline()) {
      openTimelineModal(selected);
    } else {
      showDesktopDetails(selected);
    }
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
        <article class="case-card" data-case-id="${project.id}">
          <span class="case-label">${state.ui.caseLabel}</span>
          <h3>${project.title}</h3>
          <p class="case-card__challenge"><strong>${state.ui.challenge}:</strong> ${project.challenge}</p>
          <h4 class="case-card__steps-title">${state.ui.caseActions}</h4>
          <ul class="case-card__steps">${project.actions.map((action) => `<li>${action}</li>`).join("")}</ul>
          <div class="case-card__result">
            <span>${state.ui.businessResult}</span>
            <p>${project.result}</p>
          </div>
        </article>
      `
    )
    .join("");

  if (state.carouselCleanup) state.carouselCleanup();
  const carousel = setupCasesCarousel(state.projects.length);
  state.carouselCleanup = carousel.cleanup;
  state.carouselController = carousel;
};

const setupCasesCarousel = (totalItems) => {
  const track = document.querySelector("#projects-track");
  const carousel = document.querySelector("#cases-carousel");
  const dots = document.querySelector("#carousel-dots");

  let index = 0;
  let visibleCards = getVisibleCards();
  let pointerId = null;
  let dragStartX = 0;
  let dragDelta = 0;
  let baseTranslate = 0;
  let didDrag = false;

  const maxIndex = () => Math.max(0, totalItems - visibleCards);

  const getStep = () => {
    const firstCard = track.querySelector(".case-card");
    if (!firstCard) return 0;
    return firstCard.getBoundingClientRect().width + 20;
  };

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

  const update = (animate = true) => {
    const step = getStep();
    if (!step) return;

    baseTranslate = -index * step;
    track.style.transition = animate ? "transform .35s ease" : "none";
    track.style.transform = `translate3d(${baseTranslate}px,0,0)`;

    dots.querySelectorAll(".carousel-dot").forEach((dot, dotIndex) => {
      dot.classList.toggle("is-active", dotIndex === index);
    });
  };

  const handleResize = () => {
    const nextVisibleCards = getVisibleCards();
    if (nextVisibleCards !== visibleCards) {
      visibleCards = nextVisibleCards;
      index = Math.min(index, maxIndex());
      buildDots();
    }
    update(false);
  };

  const handlePointerDown = (event) => {
    if (event.button !== undefined && event.button !== 0) return;

    pointerId = event.pointerId;
    dragStartX = event.clientX;
    dragDelta = 0;
    didDrag = false;
    carousel.classList.add("is-dragging");
    track.style.transition = "none";
    carousel.setPointerCapture?.(pointerId);
  };

  const handlePointerMove = (event) => {
    if (pointerId !== event.pointerId) return;

    dragDelta = event.clientX - dragStartX;
    if (Math.abs(dragDelta) > 6) didDrag = true;

    const atStart = index === 0 && dragDelta > 0;
    const atEnd = index === maxIndex() && dragDelta < 0;
    const resistance = atStart || atEnd ? 0.28 : 1;

    track.style.transform = `translate3d(${baseTranslate + dragDelta * resistance}px,0,0)`;
  };

  const finishDrag = (event) => {
    if (pointerId !== event.pointerId) return;

    const threshold = Math.min(110, Math.max(42, getStep() * 0.16));
    if (dragDelta <= -threshold) index = Math.min(maxIndex(), index + 1);
    if (dragDelta >= threshold) index = Math.max(0, index - 1);

    pointerId = null;
    dragDelta = 0;
    carousel.classList.remove("is-dragging");
    carousel.releasePointerCapture?.(event.pointerId);
    update();
  };

  const suppressClickAfterDrag = (event) => {
    if (!didDrag) return;
    event.preventDefault();
    event.stopPropagation();
    didDrag = false;
  };

  window.addEventListener("resize", handleResize);
  carousel.addEventListener("pointerdown", handlePointerDown);
  carousel.addEventListener("pointermove", handlePointerMove);
  carousel.addEventListener("pointerup", finishDrag);
  carousel.addEventListener("pointercancel", finishDrag);
  carousel.addEventListener("click", suppressClickAfterDrag, true);

  buildDots();
  requestAnimationFrame(() => update(false));

  const goToCase = (caseId) => {
    const projectIndex = state.projects.findIndex((project) => project.id === caseId);
    if (projectIndex < 0) return;
    index = Math.min(projectIndex, maxIndex());
    update();
    window.setTimeout(() => {
      const card = track.querySelector(`[data-case-id="${caseId}"]`);
      card?.classList.add("is-highlighted");
      window.setTimeout(() => card?.classList.remove("is-highlighted"), 1600);
    }, 420);
  };

  const cleanup = () => {
    window.removeEventListener("resize", handleResize);
    carousel.removeEventListener("pointerdown", handlePointerDown);
    carousel.removeEventListener("pointermove", handlePointerMove);
    carousel.removeEventListener("pointerup", finishDrag);
    carousel.removeEventListener("pointercancel", finishDrag);
    carousel.removeEventListener("click", suppressClickAfterDrag, true);
  };

  return { cleanup, goToCase };
};

const openCaseFromTimeline = (caseId) => {
  const navigate = () => {
    document.querySelector("#projects").scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => state.carouselController?.goToCase(caseId), 380);
  };

  const modal = document.querySelector("#timeline-modal");
  if (!modal.hidden) {
    closeTimelineModal();
    window.setTimeout(navigate, 240);
  } else {
    navigate();
  }
};

const setupTimelineCaseLinks = () => {
  document.addEventListener("click", (event) => {
    const link = event.target.closest(".timeline-case-link");
    if (!link) return;
    openCaseFromTimeline(link.dataset.caseId);
  });
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


const setupRevealAnimations = () => {
  const targets = document.querySelectorAll(
    ".section:not(.hero) > .container, .hero .profile-card, .hero .experience-summary"
  );

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    targets.forEach((target) => target.classList.add("is-revealed"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-revealed");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
  );

  targets.forEach((target) => {
    target.classList.add("reveal");
    observer.observe(target);
  });
};

const init = async () => {
  try {
    setupThemeToggle();
    setupLanguageSwitcher();
    setupScrollNavigation();
    setupTimelineModal();
    setupTimelineCaseLinks();

    await loadLanguage(state.language);
    setupRevealAnimations();

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
