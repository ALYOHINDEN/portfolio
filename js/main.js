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
  lastTimelineTrigger: null,
  lastCaseTrigger: null,
  currentTimelineItem: null,
  modalView: null,
};

const loadJson = async (path) => {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Could not load ${path}`);
  return response.json();
};

const getText = (path) => path.split(".").reduce((value, key) => value?.[key], state.ui) ?? "";

const formatText = (template, values) =>
  Object.entries(values).reduce((text, [key, value]) => text.replace(`{${key}}`, value), template);

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
  document.querySelector("#contact-phone").href = `tel:${profile.phone.replace(/[^+\d]/g, "")}`;

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
      `,
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
      `,
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

  ${
    item.caseId
      ? `
        <button
          class="timeline-case-link"
          type="button"
          data-case-id="${item.caseId}"
        >
          ${state.ui.achievements}
          <span aria-hidden="true">→</span>
        </button>
      `
      : ""
  }
`;

const buildCaseDetails = (project, showBackButton = false) => `
  ${
    showBackButton
      ? `
        <button
          class="content-modal__back"
          type="button"
          data-case-back
        >
          <span aria-hidden="true">←</span>
          ${state.ui.backToExperience}
        </button>
      `
      : ""
  }

  <div class="content-modal__case">
    ${buildCaseContent(project, "content-modal-title")}
  </div>
`;

const closeContentModal = () => {
  const modal = document.querySelector("#content-modal");
  if (modal.hidden) return;

  modal.classList.remove("is-visible");
  document.body.classList.remove("modal-open");

  window.setTimeout(() => {
    modal.hidden = true;

    document.querySelector("#content-modal-content").innerHTML = "";

    const dialog = modal.querySelector(".content-modal__dialog");
    const backdrop = modal.querySelector(".content-modal__backdrop");

    dialog.style.removeProperty("transform");
    dialog.style.removeProperty("transition");
    backdrop.style.removeProperty("opacity");

    const trigger = state.modalView === "case" ? state.lastCaseTrigger : state.lastTimelineTrigger;

    state.modalView = null;

    trigger?.focus?.({ preventScroll: true });
  }, 320);
};

const openContentModal = ({ content, view, dialogLabel, closeLabel }) => {
  const modal = document.querySelector("#content-modal");
  const contentElement = document.querySelector("#content-modal-content");
  const backdrop = modal.querySelector(".content-modal__backdrop");
  const dialog = modal.querySelector(".content-modal__dialog");

  contentElement.innerHTML = content;

  backdrop.setAttribute("aria-label", closeLabel);
  dialog.setAttribute("aria-label", dialogLabel);
  dialog.setAttribute("tabindex", "-1");

  state.modalView = view;

  dialog.scrollTop = 0;
  contentElement.scrollTop = 0;

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

const openTimelineModal = (item) => {
  state.currentTimelineItem = item;

  openContentModal({
    content: buildTimelineDetails(item, "content-modal-title"),
    view: "timeline",
    dialogLabel: state.ui.timelineDialogLabel,
    closeLabel: state.ui.timelineDialogClose,
  });
};

const openCaseModal = (caseId, trigger = null) => {
  const project = state.projects.find((item) => item.id === caseId);
  if (!project) return;

  if (trigger) {
    state.lastCaseTrigger = trigger;
  }

  const modal = document.querySelector("#content-modal");

  const cameFromMobileTimeline =
    isMobileTimeline() && !modal.hidden && state.modalView === "timeline";

  openContentModal({
    content: buildCaseDetails(project, cameFromMobileTimeline),
    view: "case",
    dialogLabel: state.ui.caseDialogLabel,
    closeLabel: state.ui.caseDialogClose,
  });
};

const setupContentModal = () => {
  const modal = document.querySelector("#content-modal");

  modal.querySelectorAll("[data-content-modal-close]").forEach((button) => {
    button.onclick = closeContentModal;
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) {
      closeContentModal();
    }
  });

  const dialog = modal.querySelector(".content-modal__dialog");
  const backdrop = modal.querySelector(".content-modal__backdrop");
  const dragZone = document.querySelector("#content-modal-drag-zone");
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
      closeContentModal();
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
      `,
    )
    .join("");

  showDesktopDetails(items[0]);
  closeContentModal();

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
    state.currentTimelineItem = selected;

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

const buildCaseContent = (project, titleId = "") => `
  <span class="case-label">${state.ui.caseLabel}</span>

  <h3 ${titleId ? `id="${titleId}"` : ""} class="case-content__title">
    ${project.title}
  </h3>

  <p class="case-content__challenge">
    <strong>${state.ui.challenge}:</strong>
    ${project.challenge}
  </p>

  <h4 class="case-content__steps-title">
    ${state.ui.caseActions}
  </h4>

  <ul class="case-content__steps">
    ${project.actions.map((action) => `<li>${action}</li>`).join("")}
  </ul>

  <section class="case-content__result">
    <span>${state.ui.businessResult}</span>
    <p>${project.result}</p>
  </section>
`;

const renderProjects = () => {
  const track = document.querySelector("#projects-track");

  track.innerHTML = state.projects
    .map(
      (project) => `
        <article
          class="case-card"
          data-case-id="${project.id}"
          tabindex="0"
          role="button"
          aria-label="${state.ui.openCase}: ${project.title}"
        >
          ${buildCaseContent(project)}
        </article>
      `,
    )
    .join("");

  if (state.carouselCleanup) {
    state.carouselCleanup();
  }

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
  let userInteracted = false;
  let swipeHintAnimation = null;
  let swipeHintObserver = null;

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
      dot.setAttribute("aria-label", formatText(state.ui.carouselGroup, { number: dotIndex + 1 }));
      dot.onclick = () => {
        userInteracted = true;
        swipeHintAnimation?.cancel();
        swipeHintObserver?.disconnect();

        index = dotIndex;
        update();
      };
      dots.appendChild(dot);
    }
  };

  const update = (animate = true) => {
    const step = getStep();
    if (!step) return;

    baseTranslate = Math.round(-index * step);
    track.style.transition = animate ? "transform .35s ease" : "none";
    track.style.transform = `translateX(${baseTranslate}px)`;

    dots.querySelectorAll(".carousel-dot").forEach((dot, dotIndex) => {
      dot.classList.toggle("is-active", dotIndex === index);
    });
  };

  const playSwipeHint = () => {
    if (window.innerWidth > 760) return;
    if (maxIndex() === 0) return;
    if (userInteracted) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    swipeHintAnimation = track.animate(
      [
        {
          transform: `translateX(${baseTranslate}px)`,
        },
        {
          transform: `translateX(${baseTranslate - 20}px)`,
          offset: 0.12,
        },
        {
          transform: `translateX(${baseTranslate - 20}px)`,
          offset: 0.88,
        },
        {
          transform: `translateX(${baseTranslate}px)`,
        },
      ],
      {
        duration: 2400,
        easing: "cubic-bezier(.2, .75, .25, 1)",
      },
    );
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

    userInteracted = true;
    swipeHintAnimation?.cancel();
    swipeHintObserver?.disconnect();
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

    track.style.transform = `translateX(${Math.round(baseTranslate + dragDelta * resistance)}px)`;
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

  if (window.innerWidth <= 760 && maxIndex() > 0) {
    swipeHintObserver = new IntersectionObserver(
      (entries, observer) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;

        window.setTimeout(() => {
          if (!userInteracted) {
            playSwipeHint();
          }
        }, 1000);

        observer.disconnect();
      },
      {
        threshold: 0.45,
      },
    );

    swipeHintObserver.observe(carousel);
  }

  const cleanup = () => {
    swipeHintAnimation?.cancel();
    swipeHintObserver?.disconnect();

    window.removeEventListener("resize", handleResize);
    carousel.removeEventListener("pointerdown", handlePointerDown);
    carousel.removeEventListener("pointermove", handlePointerMove);
    carousel.removeEventListener("pointerup", finishDrag);
    carousel.removeEventListener("pointercancel", finishDrag);
    carousel.removeEventListener("click", suppressClickAfterDrag, true);
  };

  return { cleanup };
};

const setupContentModalNavigation = () => {
  document.addEventListener("click", (event) => {
    const timelineCaseLink = event.target.closest(".timeline-case-link");

    if (timelineCaseLink) {
      openCaseModal(timelineCaseLink.dataset.caseId, timelineCaseLink);

      return;
    }

    const caseCard = event.target.closest(".case-card");

    if (caseCard) {
      openCaseModal(caseCard.dataset.caseId, caseCard);
      return;
    }

    const backButton = event.target.closest("[data-case-back]");

    if (backButton && state.currentTimelineItem) {
      openContentModal({
        content: buildTimelineDetails(state.currentTimelineItem, "content-modal-title"),
        view: "timeline",
        dialogLabel: state.ui.timelineDialogLabel,
        closeLabel: state.ui.timelineDialogClose,
      });
    }
  });

  document.addEventListener("keydown", (event) => {
    const card = event.target.closest(".case-card");
    if (!card) return;

    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    openCaseModal(card.dataset.caseId, card);
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
      window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4;

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
      currentId !== null && link.getAttribute("href") === `#${currentId}`,
    );
  });
};

const setupMobileMenu = () => {
  const button = document.querySelector("#menu-toggle");
  const nav = document.querySelector("#main-nav");

  if (!button || !nav) return;

  const closeMenu = () => {
    button.setAttribute("aria-expanded", "false");
    nav.classList.remove("is-open");
  };

  const openMenu = () => {
    button.setAttribute("aria-expanded", "true");
    nav.classList.add("is-open");
  };

  button.addEventListener("click", () => {
    const isOpen = button.getAttribute("aria-expanded") === "true";

    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  nav.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      closeMenu();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMenu();
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 760) {
      closeMenu();
    }
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
  toggle.setAttribute("aria-label", isDark ? state.ui.themeToLight : state.ui.themeToDark);
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
    loadJson(`${base}/projects.json`),
  ]);

  Object.assign(state, {
    language,
    ui,
    profile,
    workflow,
    timeline,
    skills,
    projects,
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

const setupMobileDiscoveryHints = () => {
  if (window.innerWidth > 760) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const timelineList = document.querySelector("#timeline-list");

  if (timelineList) {
    const timelineObserver = new IntersectionObserver(
      (entries, observer) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;

        window.setTimeout(() => {
          timelineList.classList.add("is-discovery-hint");

          window.setTimeout(() => {
            timelineList.classList.remove("is-discovery-hint");
          }, 2400);
        }, 1000);

        observer.disconnect();
      },
      {
        threshold: 0.35,
      },
    );

    timelineObserver.observe(timelineList);
  }
};

const setupRevealAnimations = () => {
  const targets = document.querySelectorAll(
    ".section:not(.hero) > .container, .hero .profile-card, .hero .experience-summary",
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
    { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
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
    setupMobileMenu();
    setupScrollNavigation();
    setupContentModal();
    setupContentModalNavigation();

    await loadLanguage(state.language);
    setupRevealAnimations();
    setupMobileDiscoveryHints();

    document.querySelector("#year").textContent = new Date().getFullYear();
  } catch (error) {
    console.error(error);
    document.body.insertAdjacentHTML(
      "afterbegin",
      `<div style="padding:12px;background:#7f1d1d;color:#fff;text-align:center">
        ${state.ui?.loadError || "Could not load site data."}
      </div>`,
    );
  }
};

init();
