const STORAGE_KEY = "ritmo-app-v2";
const LEGACY_STORAGE_KEY = "ritmo-app-v1";
const TODAY = () => new Date().toISOString().slice(0, 10);

const initialState = {
  version: 2,
  theme: "dark",
  notificationSettings: {
    enabled: false,
    dailyTime: "08:00",
    workoutTime: "18:00",
    lastDailyKey: "",
    lastWorkoutKey: "",
    notifiedKeys: {},
  },
  habits: [
    { id: crypto.randomUUID(), name: "Beber 2 litros de água", icon: "◉", reminderTime: "09:00", history: [] },
    { id: crypto.randomUUID(), name: "Treinar", icon: "◆", reminderTime: "18:00", history: [] },
    { id: crypto.randomUUID(), name: "Ler 10 páginas", icon: "▤", reminderTime: "21:00", history: [TODAY()] },
  ],
  tasks: [
    {
      id: crypto.randomUUID(),
      name: "Planejar as prioridades do dia",
      priority: "Alta",
      category: "Pessoal",
      dueDate: TODAY(),
      reminderTime: "08:30",
      done: false,
      notifiedKey: "",
    },
    {
      id: crypto.randomUUID(),
      name: "Organizar documentos",
      priority: "Média",
      category: "Trabalho",
      dueDate: "",
      reminderTime: "",
      done: false,
      notifiedKey: "",
    },
  ],
  goals: [
    { id: crypto.randomUUID(), name: "Reserva de emergência", current: 1200, target: 5000, deadline: "2026-12-20" },
    { id: crypto.randomUUID(), name: "Completar 30 treinos", current: 8, target: 30, deadline: "2026-09-30" },
  ],
  workouts: [
    {
      id: crypto.randomUUID(),
      name: "Supino reto",
      sets: [
        { id: crypto.randomUUID(), kg: 30, reps: 12, done: false },
        { id: crypto.randomUUID(), kg: 35, reps: 10, done: false },
        { id: crypto.randomUUID(), kg: 40, reps: 8, done: false },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: "Desenvolvimento",
      sets: [
        { id: crypto.randomUUID(), kg: 18, reps: 12, done: false },
        { id: crypto.randomUUID(), kg: 20, reps: 10, done: false },
        { id: crypto.randomUUID(), kg: 22, reps: 8, done: false },
      ],
    },
  ],
  workoutHistory: [],
};

let state = loadState();
let currentPage = "home";
let modalContext = null;
let saveStatusTimer = null;

const content = document.querySelector("#app-content");
const pageTitle = document.querySelector("#page-title");
const todayLabel = document.querySelector("#today-label");
const modalBackdrop = document.querySelector("#modal-backdrop");
const modalTitle = document.querySelector("#modal-title");
const modalForm = document.querySelector("#modal-form");
const toast = document.querySelector("#toast");
const saveStatus = document.querySelector("#save-status");
const backupFile = document.querySelector("#backup-file");

function cloneInitialState() {
  return structuredClone(initialState);
}

function normalizeState(raw) {
  const base = cloneInitialState();
  if (!raw || typeof raw !== "object") return base;

  const habits = Array.isArray(raw.habits) ? raw.habits.map((habit) => ({
    id: habit.id || crypto.randomUUID(),
    name: habit.name || "Novo hábito",
    icon: habit.icon || "✓",
    reminderTime: habit.reminderTime || "",
    history: Array.isArray(habit.history)
      ? habit.history
      : habit.done
        ? [TODAY()]
        : [],
  })) : base.habits;

  const tasks = Array.isArray(raw.tasks) ? raw.tasks.map((task) => ({
    id: task.id || crypto.randomUUID(),
    name: task.name || "Nova tarefa",
    priority: task.priority || "Média",
    category: task.category || "Pessoal",
    dueDate: task.dueDate || "",
    reminderTime: task.reminderTime || "",
    done: Boolean(task.done),
    notifiedKey: task.notifiedKey || "",
  })) : base.tasks;

  return {
    ...base,
    ...raw,
    version: 2,
    theme: raw.theme || "dark",
    notificationSettings: {
      ...base.notificationSettings,
      ...(raw.notificationSettings || {}),
    },
    habits,
    tasks,
    goals: Array.isArray(raw.goals) ? raw.goals : base.goals,
    workouts: Array.isArray(raw.workouts) ? raw.workouts : base.workouts,
    workoutHistory: Array.isArray(raw.workoutHistory) ? raw.workoutHistory : [],
  };
}

function loadState() {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    return normalizeState(JSON.parse(current || legacy || "null"));
  } catch {
    return cloneInitialState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  saveStatus.textContent = "Salvando";
  saveStatus.classList.add("saving");
  clearTimeout(saveStatusTimer);
  saveStatusTimer = setTimeout(() => {
    saveStatus.textContent = "Salvo";
    saveStatus.classList.remove("saving");
  }, 450);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(date) {
  if (!date) return "Sem prazo";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" })
    .format(new Date(`${date}T12:00:00`));
}

function isHabitDone(habit) {
  return habit.history.includes(TODAY());
}

function habitStreak(habit) {
  const history = new Set(habit.history);
  let streak = 0;
  const cursor = new Date();
  if (!history.has(TODAY())) cursor.setDate(cursor.getDate() - 1);
  while (history.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function taskStatus(task) {
  if (task.done) return "Concluída";
  if (task.dueDate && task.dueDate < TODAY()) return "Vencida";
  if (task.dueDate === TODAY()) return "Hoje";
  return task.dueDate ? formatDate(task.dueDate) : "Sem prazo";
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2400);
}

function progress(current, target) {
  if (!target) return 0;
  return Math.min(100, Math.round((Number(current) / Number(target)) * 100));
}

function render() {
  document.body.classList.toggle("light", state.theme === "light");
  document.querySelector("#theme-button").textContent = state.theme === "light" ? "☀" : "☾";
  document.querySelector("#notification-dot").classList.toggle("active", state.notificationSettings.enabled);
  todayLabel.textContent = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date());

  const pages = {
    home: ["Meu Dia", renderHome],
    habits: ["Hábitos", renderHabits],
    tasks: ["Tarefas", renderTasks],
    workouts: ["Treinos", renderWorkouts],
    goals: ["Metas", renderGoals],
  };

  pageTitle.textContent = pages[currentPage][0];
  content.innerHTML = pages[currentPage][1]();
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.page === currentPage);
  });
}

function renderHome() {
  const habitsDone = state.habits.filter(isHabitDone).length;
  const tasksOpen = state.tasks.filter((item) => !item.done).length;
  const totalSets = state.workouts.flatMap((item) => item.sets);
  const setsDone = totalSets.filter((item) => item.done).length;
  const totalToday = state.habits.length + state.tasks.filter((task) => task.dueDate === TODAY()).length;
  const completedToday = habitsDone + state.tasks.filter((task) => task.done && task.dueDate === TODAY()).length;
  const dailyProgress = progress(completedToday, totalToday);
  const nextTasks = state.tasks
    .filter((item) => !item.done)
    .sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999"))
    .slice(0, 3);

  return `
    <section class="card hero-card reveal">
      <div class="hero-orbit" aria-hidden="true"></div>
      <p class="section-label">Seu ritmo hoje</p>
      <h2>${dailyProgress >= 100 ? "Dia concluído." : "Um passo de cada vez."}</h2>
      <p class="muted">${dailyProgress}% do essencial de hoje já foi feito.</p>
      <div class="hero-progress">
        <div class="progress-track"><div class="progress-fill" style="width:${dailyProgress}%"></div></div>
      </div>
      <div class="summary-grid">
        <div class="summary-item"><span class="summary-value">${habitsDone}/${state.habits.length}</span><small>hábitos</small></div>
        <div class="summary-item"><span class="summary-value">${tasksOpen}</span><small>tarefas</small></div>
        <div class="summary-item"><span class="summary-value">${setsDone}</span><small>séries</small></div>
      </div>
    </section>
    <section class="quick-actions reveal">
      <button class="quick-action" data-modal="task"><span>+</span><small>Tarefa</small></button>
      <button class="quick-action" data-modal="habit"><span>+</span><small>Hábito</small></button>
      <button class="quick-action" data-go="workouts"><span>◆</span><small>Treinar</small></button>
      <button class="quick-action" data-modal="goal"><span>◎</span><small>Meta</small></button>
    </section>
    <section class="section reveal">
      <div class="section-heading">
        <p class="section-label">Próximas tarefas</p>
        <button class="text-button" data-go="tasks">Ver todas</button>
      </div>
      <div class="card list-card">
        ${nextTasks.length ? nextTasks.map(taskRow).join("") : '<div class="empty-state">Tudo concluído por hoje.</div>'}
      </div>
    </section>
    <section class="section reveal">
      <div class="section-heading">
        <p class="section-label">Hábitos de hoje</p>
        <button class="text-button" data-go="habits">Abrir</button>
      </div>
      <div class="card list-card">
        ${state.habits.slice(0, 4).map(habitRow).join("")}
      </div>
    </section>`;
}

function habitRow(item) {
  const done = isHabitDone(item);
  const streak = habitStreak(item);
  return `
    <div class="list-row ${done ? "done" : ""}">
      <button class="check ${done ? "checked" : ""}" data-action="toggle-habit" data-id="${item.id}" aria-label="Concluir hábito"></button>
      <div class="row-content">
        <span class="row-title">${escapeHtml(item.icon)} ${escapeHtml(item.name)}</span>
        <span class="row-meta">${done ? "Concluído hoje" : item.reminderTime ? `Lembrete às ${item.reminderTime}` : "Sem lembrete"}${streak ? ` · ${streak} dias seguidos` : ""}</span>
      </div>
      <button class="mini-button" data-modal="edit-habit" data-id="${item.id}" aria-label="Editar hábito">•••</button>
    </div>`;
}

function taskRow(item) {
  const status = taskStatus(item);
  return `
    <div class="list-row ${item.done ? "done" : ""}">
      <button class="check ${item.done ? "checked" : ""}" data-action="toggle-task" data-id="${item.id}" aria-label="Concluir tarefa"></button>
      <div class="row-content">
        <span class="row-title">${escapeHtml(item.name)}</span>
        <span class="row-meta"><span class="priority-dot ${item.priority.toLowerCase()}"></span>${escapeHtml(item.category)} · ${status}${item.reminderTime ? ` às ${item.reminderTime}` : ""}</span>
      </div>
      <button class="mini-button" data-modal="edit-task" data-id="${item.id}" aria-label="Editar tarefa">•••</button>
    </div>`;
}

function renderHabits() {
  const done = state.habits.filter(isHabitDone).length;
  return `
    <section class="card hero-card compact-hero reveal">
      <p class="section-label">Consistência diária</p>
      <h2>${done} de ${state.habits.length} concluídos</h2>
      <div class="hero-progress"><div class="progress-track"><div class="progress-fill" style="width:${progress(done, state.habits.length)}%"></div></div></div>
    </section>
    <section class="section reveal">
      <div class="section-heading">
        <p class="section-label">Hoje</p>
        <button class="text-button" data-modal="habit">+ Novo hábito</button>
      </div>
      <div class="card list-card">
        ${state.habits.length ? state.habits.map(habitRow).join("") : '<div class="empty-state">Adicione seu primeiro hábito.</div>'}
      </div>
    </section>`;
}

function renderTasks() {
  const open = state.tasks.filter((item) => !item.done);
  const overdue = open.filter((item) => item.dueDate && item.dueDate < TODAY());
  const pending = open.filter((item) => !overdue.includes(item));
  const done = state.tasks.filter((item) => item.done).slice(-8).reverse();
  return `
    <section class="section-heading reveal">
      <div>
        <p class="section-label">${open.length} pendentes</p>
        <span class="heading-note">${overdue.length ? `${overdue.length} vencida${overdue.length > 1 ? "s" : ""}` : "Tudo no prazo"}</span>
      </div>
      <button class="text-button" data-modal="task">+ Nova tarefa</button>
    </section>
    ${overdue.length ? `
      <section class="reveal">
        <p class="section-label danger-label">Vencidas</p>
        <div class="card list-card">${overdue.map(taskRow).join("")}</div>
      </section>` : ""}
    <section class="${overdue.length ? "section" : ""} reveal">
      <p class="section-label list-title">A fazer</p>
      <div class="card list-card">
        ${pending.length ? pending.map(taskRow).join("") : '<div class="empty-state">Nenhuma tarefa pendente.</div>'}
      </div>
    </section>
    <section class="section reveal">
      <div class="section-heading"><p class="section-label">Concluídas</p></div>
      <div class="card list-card">
        ${done.length ? done.map(taskRow).join("") : '<div class="empty-state">As tarefas concluídas aparecem aqui.</div>'}
      </div>
    </section>`;
}

function renderWorkouts() {
  const totalSets = state.workouts.flatMap((item) => item.sets).length;
  const doneSets = state.workouts.flatMap((item) => item.sets).filter((item) => item.done).length;
  return `
    <section class="card hero-card compact-hero reveal">
      <p class="section-label">Treino atual</p>
      <h2>${doneSets} de ${totalSets} séries</h2>
      <p class="muted">${state.workoutHistory.length} treinos registrados</p>
      <div class="hero-progress"><div class="progress-track"><div class="progress-fill" style="width:${progress(doneSets, totalSets)}%"></div></div></div>
    </section>
    <section class="section reveal">
      <div class="section-heading">
        <p class="section-label">Exercícios</p>
        <button class="text-button" data-modal="exercise">+ Exercício</button>
      </div>
      <div class="stack">
        ${state.workouts.length ? state.workouts.map(exerciseCard).join("") : '<div class="card empty-state">Adicione o primeiro exercício do treino.</div>'}
      </div>
    </section>
    ${state.workouts.length ? '<section class="section reveal"><button class="primary-button glow-button" data-action="finish-workout">Finalizar treino</button></section>' : ""}`;
}

function exerciseCard(exercise) {
  const exerciseDone = exercise.sets.length > 0 && exercise.sets.every((set) => set.done);
  return `
    <article class="card exercise-card ${exerciseDone ? "completed-card" : ""}">
      <div class="workout-header">
        <div class="workout-title-wrap">
          <button class="check exercise-complete ${exerciseDone ? "checked" : ""}" data-action="toggle-exercise" data-id="${exercise.id}" aria-label="Concluir exercício"></button>
          <div>
            <h3>${escapeHtml(exercise.name)}</h3>
            <span class="row-meta">${exercise.sets.length} séries${exerciseDone ? " · concluído" : ""}</span>
          </div>
        </div>
        <button class="mini-button" data-modal="edit-exercise" data-id="${exercise.id}">Editar</button>
      </div>
      <div class="set-head"><span>Série</span><span>Kg</span><span>Reps</span><span>Feito</span><span></span></div>
      ${exercise.sets.map((set, index) => `
        <div class="set-row ${set.done ? "done" : ""}">
          <span class="set-number">${index + 1}</span>
          <input class="set-input" type="number" min="0" inputmode="decimal" value="${set.kg}" data-action="update-set" data-field="kg" data-exercise="${exercise.id}" data-id="${set.id}" aria-label="Peso da série ${index + 1}">
          <input class="set-input" type="number" min="0" inputmode="numeric" value="${set.reps}" data-action="update-set" data-field="reps" data-exercise="${exercise.id}" data-id="${set.id}" aria-label="Repetições da série ${index + 1}">
          <button class="check ${set.done ? "checked" : ""}" data-action="toggle-set" data-exercise="${exercise.id}" data-id="${set.id}" aria-label="Concluir série ${index + 1}"></button>
          <button class="mini-button remove-set" data-action="delete-set" data-exercise="${exercise.id}" data-id="${set.id}" aria-label="Excluir série ${index + 1}">×</button>
        </div>`).join("")}
      <div class="exercise-actions">
        <button class="secondary-button" data-action="add-set" data-id="${exercise.id}">+ Série</button>
        <button class="danger-button" data-action="delete-exercise" data-id="${exercise.id}">Excluir</button>
      </div>
    </article>`;
}

function renderGoals() {
  return `
    <section class="section-heading reveal">
      <p class="section-label">Em andamento</p>
      <button class="text-button" data-modal="goal">+ Nova meta</button>
    </section>
    <div class="stack reveal">
      ${state.goals.length ? state.goals.map((goal) => `
        <article class="card goal-card">
          <div class="goal-top">
            <div><h3>${escapeHtml(goal.name)}</h3><span class="row-meta">Até ${formatDate(goal.deadline)}</span></div>
            <button class="mini-button" data-modal="edit-goal" data-id="${goal.id}">Editar</button>
          </div>
          <div class="goal-percentage">${progress(goal.current, goal.target)}%</div>
          <div class="progress-track"><div class="progress-fill" style="width:${progress(goal.current, goal.target)}%"></div></div>
          <div class="goal-values"><span>${Number(goal.current).toLocaleString("pt-BR")} de ${Number(goal.target).toLocaleString("pt-BR")}</span><button class="text-button contribution-button" data-modal="contribute-goal" data-id="${goal.id}">+ Progresso</button></div>
        </article>`).join("") : '<div class="card empty-state">Crie uma meta para acompanhar seu progresso.</div>'}
    </div>`;
}

function formField(label, name, value = "", type = "text", attrs = "") {
  return `<div class="field"><label for="${name}">${label}</label><input id="${name}" name="${name}" type="${type}" value="${escapeHtml(value)}" ${attrs}></div>`;
}

function openModal(type, id = null) {
  modalContext = { type, id };
  const habit = id ? state.habits.find((item) => item.id === id) : null;
  const task = id ? state.tasks.find((item) => item.id === id) : null;
  const exercise = id ? state.workouts.find((item) => item.id === id) : null;
  const goal = id ? state.goals.find((item) => item.id === id) : null;
  const settings = state.notificationSettings;

  const configs = {
    habit: {
      title: "Novo hábito",
      fields: `${formField("Nome", "name", "", "text", 'required placeholder="Ex.: Beber água"')}${formField("Símbolo", "icon", "✓", "text", 'maxlength="2"')}${formField("Lembrete diário", "reminderTime", "", "time")}`,
    },
    "edit-habit": {
      title: "Editar hábito",
      fields: `${formField("Nome", "name", habit?.name, "text", "required")}${formField("Símbolo", "icon", habit?.icon, "text", 'maxlength="2"')}${formField("Lembrete diário", "reminderTime", habit?.reminderTime, "time")}<button type="button" class="danger-button" data-action-modal="delete-habit">Excluir hábito</button>`,
    },
    task: {
      title: "Nova tarefa",
      fields: `${formField("Tarefa", "name", "", "text", 'required placeholder="O que precisa ser feito?"')}
        <div class="field"><label for="category">Categoria</label><select id="category" name="category"><option>Pessoal</option><option>Trabalho</option><option>Estudos</option><option>Saúde</option><option>Financeiro</option></select></div>
        <div class="field"><label for="priority">Prioridade</label><select id="priority" name="priority"><option>Alta</option><option selected>Média</option><option>Baixa</option></select></div>
        ${formField("Prazo", "dueDate", TODAY(), "date")}${formField("Horário do lembrete", "reminderTime", "", "time")}`,
    },
    "edit-task": {
      title: "Editar tarefa",
      fields: `${formField("Tarefa", "name", task?.name, "text", "required")}
        <div class="field"><label for="category">Categoria</label><select id="category" name="category">${["Pessoal", "Trabalho", "Estudos", "Saúde", "Financeiro"].map((value) => `<option ${task?.category === value ? "selected" : ""}>${value}</option>`).join("")}</select></div>
        <div class="field"><label for="priority">Prioridade</label><select id="priority" name="priority">${["Alta", "Média", "Baixa"].map((value) => `<option ${task?.priority === value ? "selected" : ""}>${value}</option>`).join("")}</select></div>
        ${formField("Prazo", "dueDate", task?.dueDate, "date")}${formField("Horário do lembrete", "reminderTime", task?.reminderTime, "time")}<button type="button" class="danger-button" data-action-modal="delete-task">Excluir tarefa</button>`,
    },
    goal: {
      title: "Nova meta",
      fields: `${formField("Meta", "name", "", "text", 'required placeholder="Ex.: Reserva de emergência"')}${formField("Progresso atual", "current", "0", "number", 'min="0" required')}${formField("Objetivo", "target", "", "number", 'min="1" required')}${formField("Prazo", "deadline", "", "date")}`,
    },
    "edit-goal": {
      title: "Editar meta",
      fields: `${formField("Meta", "name", goal?.name, "text", "required")}${formField("Progresso atual", "current", goal?.current, "number", 'min="0" required')}${formField("Objetivo", "target", goal?.target, "number", 'min="1" required')}${formField("Prazo", "deadline", goal?.deadline, "date")}<button type="button" class="danger-button" data-action-modal="delete-goal">Excluir meta</button>`,
    },
    "contribute-goal": {
      title: "Adicionar progresso",
      fields: `<p class="modal-description">${escapeHtml(goal?.name)}</p>${formField("Quanto deseja adicionar?", "amount", "", "number", 'min="0.01" step="0.01" required autofocus')}`,
    },
    exercise: {
      title: "Novo exercício",
      fields: `${formField("Exercício", "name", "", "text", 'required placeholder="Ex.: Agachamento"')}${formField("Quantidade de séries", "sets", "3", "number", 'min="1" max="10" required')}`,
    },
    "edit-exercise": {
      title: "Editar exercício",
      fields: `${formField("Nome", "name", exercise?.name, "text", "required")}<button type="button" class="danger-button" data-action-modal="delete-exercise">Excluir exercício</button>`,
    },
    notifications: {
      title: "Lembretes e dados",
      fields: `
        ${!window.isSecureContext ? '<div class="notice-card"><strong>Notificações precisam de conexão segura</strong><p>O salvamento já funciona neste endereço. Para receber alertas no celular, publique o app em HTTPS ou instale uma versão nativa.</p></div>' : ""}
        <div class="settings-card">
          <div><strong>Notificações</strong><p class="muted small-copy">Receba lembretes enquanto o app estiver ativo.</p></div>
          <label class="switch"><input name="enabled" type="checkbox" ${settings.enabled ? "checked" : ""}><span></span></label>
        </div>
        ${formField("Resumo diário", "dailyTime", settings.dailyTime, "time")}
        ${formField("Lembrete de treino", "workoutTime", settings.workoutTime, "time")}
        <button type="button" class="secondary-button" data-action-modal="test-notification">Testar notificação</button>
        <div class="data-tools">
          <p class="section-label">Segurança dos dados</p>
          <p class="muted small-copy">Tudo é salvo automaticamente neste aparelho. Crie um arquivo de backup para não perder seus dados se limpar o navegador.</p>
          <div class="form-actions">
            <button type="button" class="secondary-button" data-action-modal="export-data">Criar backup</button>
            <button type="button" class="secondary-button" data-action-modal="import-data">Restaurar</button>
          </div>
        </div>`,
    },
  };

  const config = configs[type];
  if (!config) return;
  modalTitle.textContent = config.title;
  modalForm.innerHTML = `
    <div class="form-grid">
      ${config.fields}
      <div class="form-actions">
        <button type="button" class="secondary-button" data-close-modal>Cancelar</button>
        <button type="submit" class="primary-button">Salvar</button>
      </div>
    </div>`;
  modalBackdrop.classList.remove("hidden");
  modalForm.querySelector("input:not([type='checkbox'])")?.focus();
}

function closeModal() {
  modalBackdrop.classList.add("hidden");
  modalContext = null;
}

async function requestNotificationPermission() {
  if (!window.isSecureContext) {
    showToast("Notificações exigem um endereço HTTPS");
    return false;
  }
  if (!("Notification" in window)) {
    showToast("Este navegador não oferece notificações");
    return false;
  }
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") {
    showToast("Notificações bloqueadas nas configurações do navegador");
    return false;
  }
  return (await Notification.requestPermission()) === "granted";
}

async function sendNotification(title, body) {
  const allowed = await requestNotificationPermission();
  if (!allowed) return false;
  const registration = await navigator.serviceWorker?.ready;
  if (registration) {
    await registration.showNotification(title, {
      body,
      icon: "./icon.svg",
      badge: "./icon.svg",
      tag: `ritmo-${title}`,
      renotify: true,
    });
  } else {
    new Notification(title, { body, icon: "./icon.svg" });
  }
  return true;
}

function currentTime() {
  return new Date().toTimeString().slice(0, 5);
}

function checkReminders() {
  if (!("Notification" in window) || !state.notificationSettings.enabled || Notification.permission !== "granted") return;
  const now = currentTime();
  const today = TODAY();
  let changed = false;

  for (const task of state.tasks) {
    const key = `${today}-${task.reminderTime}`;
    if (!task.done && task.dueDate === today && task.reminderTime && now >= task.reminderTime && task.notifiedKey !== key) {
      sendNotification("Tarefa para hoje", task.name);
      task.notifiedKey = key;
      changed = true;
    }
  }

  for (const habit of state.habits) {
    const key = `${today}-${habit.id}-${habit.reminderTime}`;
    if (!isHabitDone(habit) && habit.reminderTime && now >= habit.reminderTime && !state.notificationSettings.notifiedKeys[key]) {
      sendNotification("Hora do seu hábito", habit.name);
      state.notificationSettings.notifiedKeys[key] = true;
      changed = true;
    }
  }

  const dailyKey = `${today}-summary`;
  if (now >= state.notificationSettings.dailyTime && state.notificationSettings.lastDailyKey !== dailyKey) {
    const pending = state.tasks.filter((task) => !task.done).length + state.habits.filter((habit) => !isHabitDone(habit)).length;
    if (pending) sendNotification("Seu dia no Ritmo", `Você tem ${pending} itens pendentes.`);
    state.notificationSettings.lastDailyKey = dailyKey;
    changed = true;
  }

  const workoutKey = `${today}-workout`;
  const workoutHasProgress = state.workouts.some((exercise) => exercise.sets.some((set) => set.done));
  const workoutCompletedToday = state.workoutHistory.some((entry) => entry.date?.slice(0, 10) === today);
  if (
    state.workouts.length
    && !workoutHasProgress
    && !workoutCompletedToday
    && now >= state.notificationSettings.workoutTime
    && state.notificationSettings.lastWorkoutKey !== workoutKey
  ) {
    sendNotification("Hora de treinar", "Seu treino está pronto para começar.");
    state.notificationSettings.lastWorkoutKey = workoutKey;
    changed = true;
  }

  Object.keys(state.notificationSettings.notifiedKeys).forEach((key) => {
    if (!key.startsWith(today)) delete state.notificationSettings.notifiedKeys[key];
  });

  if (changed) saveState();
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `ritmo-backup-${TODAY()}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  showToast("Backup criado");
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      state = normalizeState(JSON.parse(reader.result));
      saveState();
      closeModal();
      render();
      showToast("Dados restaurados");
    } catch {
      showToast("Arquivo de backup inválido");
    }
  };
  reader.readAsText(file);
}

function handleModalSubmit(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(modalForm));
  const { type, id } = modalContext;

  if (type === "habit") {
    state.habits.push({ id: crypto.randomUUID(), name: data.name.trim(), icon: data.icon.trim() || "✓", reminderTime: data.reminderTime, history: [] });
  } else if (type === "edit-habit") {
    Object.assign(state.habits.find((item) => item.id === id), { name: data.name.trim(), icon: data.icon.trim() || "✓", reminderTime: data.reminderTime });
  } else if (type === "task") {
    state.tasks.push({ id: crypto.randomUUID(), name: data.name.trim(), category: data.category, priority: data.priority, dueDate: data.dueDate, reminderTime: data.reminderTime, done: false, notifiedKey: "" });
  } else if (type === "edit-task") {
    Object.assign(state.tasks.find((item) => item.id === id), { name: data.name.trim(), category: data.category, priority: data.priority, dueDate: data.dueDate, reminderTime: data.reminderTime, notifiedKey: "" });
  } else if (type === "goal") {
    state.goals.push({ id: crypto.randomUUID(), name: data.name.trim(), current: Number(data.current), target: Number(data.target), deadline: data.deadline });
  } else if (type === "edit-goal") {
    Object.assign(state.goals.find((item) => item.id === id), { name: data.name.trim(), current: Number(data.current), target: Number(data.target), deadline: data.deadline });
  } else if (type === "contribute-goal") {
    const goal = state.goals.find((item) => item.id === id);
    goal.current = Math.min(Number(goal.target), Number(goal.current) + Number(data.amount));
  } else if (type === "exercise") {
    state.workouts.push({
      id: crypto.randomUUID(),
      name: data.name.trim(),
      sets: Array.from({ length: Number(data.sets) }, () => ({ id: crypto.randomUUID(), kg: 0, reps: 10, done: false })),
    });
  } else if (type === "edit-exercise") {
    state.workouts.find((item) => item.id === id).name = data.name.trim();
  } else if (type === "notifications") {
    state.notificationSettings.enabled = data.enabled === "on";
    state.notificationSettings.dailyTime = data.dailyTime;
    state.notificationSettings.workoutTime = data.workoutTime;
    if (state.notificationSettings.enabled) requestNotificationPermission();
  }

  saveState();
  closeModal();
  render();
  showToast("Salvo com sucesso");
}

function deleteItem(collection, id) {
  state[collection] = state[collection].filter((item) => item.id !== id);
  saveState();
  closeModal();
  render();
  showToast("Item excluído");
}

document.querySelector(".bottom-nav").addEventListener("click", (event) => {
  const button = event.target.closest("[data-page]");
  if (!button) return;
  currentPage = button.dataset.page;
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

document.querySelector("#theme-button").addEventListener("click", () => {
  state.theme = state.theme === "dark" ? "light" : "dark";
  saveState();
  render();
});

document.querySelector("#notification-button").addEventListener("click", () => openModal("notifications"));
document.querySelector("#close-modal").addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", (event) => {
  if (event.target === modalBackdrop || event.target.closest("[data-close-modal]")) closeModal();
});
modalForm.addEventListener("submit", handleModalSubmit);
modalForm.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action-modal]");
  if (!button) return;
  const { actionModal } = button.dataset;
  const id = modalContext?.id;
  if (actionModal === "delete-habit") deleteItem("habits", id);
  if (actionModal === "delete-task") deleteItem("tasks", id);
  if (actionModal === "delete-goal") deleteItem("goals", id);
  if (actionModal === "delete-exercise") deleteItem("workouts", id);
  if (actionModal === "export-data") exportData();
  if (actionModal === "import-data") backupFile.click();
  if (actionModal === "test-notification") {
    const sent = await sendNotification("Ritmo está pronto", "Seus lembretes estão funcionando.");
    if (sent) showToast("Notificação enviada");
  }
});

backupFile.addEventListener("change", () => {
  const [file] = backupFile.files;
  if (file) importData(file);
  backupFile.value = "";
});

content.addEventListener("click", (event) => {
  const goButton = event.target.closest("[data-go]");
  if (goButton) {
    currentPage = goButton.dataset.go;
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  const modalButton = event.target.closest("[data-modal]");
  if (modalButton) {
    openModal(modalButton.dataset.modal, modalButton.dataset.id);
    return;
  }

  const button = event.target.closest("[data-action]");
  if (!button) return;
  const { action, id, exercise: exerciseId } = button.dataset;

  if (action === "toggle-habit") {
    const item = state.habits.find((habit) => habit.id === id);
    if (isHabitDone(item)) item.history = item.history.filter((date) => date !== TODAY());
    else item.history.push(TODAY());
  } else if (action === "toggle-task") {
    const item = state.tasks.find((task) => task.id === id);
    item.done = !item.done;
  } else if (action === "delete-exercise") {
    deleteItem("workouts", id);
    return;
  } else if (action === "toggle-set") {
    const exercise = state.workouts.find((item) => item.id === exerciseId);
    const set = exercise?.sets.find((item) => item.id === id);
    if (set) set.done = !set.done;
  } else if (action === "delete-set") {
    const exercise = state.workouts.find((item) => item.id === exerciseId);
    if (exercise && exercise.sets.length > 1) exercise.sets = exercise.sets.filter((item) => item.id !== id);
    else {
      showToast("O exercício precisa ter ao menos uma série");
      return;
    }
  } else if (action === "toggle-exercise") {
    const exercise = state.workouts.find((item) => item.id === id);
    const nextValue = !exercise.sets.every((set) => set.done);
    exercise.sets.forEach((set) => { set.done = nextValue; });
  } else if (action === "add-set") {
    const exercise = state.workouts.find((item) => item.id === id);
    const previous = exercise.sets.at(-1);
    exercise.sets.push({ id: crypto.randomUUID(), kg: previous?.kg || 0, reps: previous?.reps || 10, done: false });
  } else if (action === "finish-workout") {
    const allSets = state.workouts.flatMap((item) => item.sets);
    if (allSets.some((set) => !set.done)) {
      showToast("Ainda existem séries pendentes");
      return;
    }
    state.workoutHistory.push({
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      exercises: state.workouts.length,
      sets: allSets.length,
      volume: allSets.reduce((total, set) => total + Number(set.kg) * Number(set.reps), 0),
    });
    state.workouts.forEach((exercise) => exercise.sets.forEach((set) => { set.done = false; }));
    saveState();
    render();
    showToast("Treino registrado");
    return;
  }

  saveState();
  render();
});

content.addEventListener("change", (event) => {
  const input = event.target.closest('[data-action="update-set"]');
  if (!input) return;
  const exercise = state.workouts.find((item) => item.id === input.dataset.exercise);
  const set = exercise?.sets.find((item) => item.id === input.dataset.id);
  if (set) {
    set[input.dataset.field] = Number(input.value);
    saveState();
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
}

if (navigator.storage?.persist) {
  navigator.storage.persist().catch(() => {});
}

window.addEventListener("storage", (event) => {
  if (event.key === STORAGE_KEY) {
    state = loadState();
    render();
  }
});

saveState();
render();
setInterval(checkReminders, 30_000);
setTimeout(checkReminders, 1500);
