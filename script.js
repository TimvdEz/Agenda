
"use strict";

// ===================================
// BASIS
// ===================================

const $ = id => document.getElementById(id);

const STORAGE_KEY = "simpel_planner_v1";

let records = loadRecords();
let view = "day";
let selectedDate = dateString(new Date());

let formType = "agenda";
let editingId = null;
let linkedTodoId = null;
let activePart = "start";

let startHour = 9;
let startMinute = 0;
let endHour = 10;
let endMinute = 0;
let extraDays = 0;

// ===================================
// DATUMS EN OPSLAG
// ===================================

function pad(number) {
  return String(number).padStart(2, "0");
}

function dateString(date) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("-");
}

function parseDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(value, amount) {
  const date = parseDate(value);
  date.setDate(date.getDate() + amount);
  return dateString(date);
}

function formatDate(value) {
  return parseDate(value).toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long"
  });
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  return pad(date.getHours()) + ":" + pad(date.getMinutes());
}

function loadRecords() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveRecords() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    alert("Opslaan is niet gelukt. Controleer de browseropslag.");
  }
  render();
}

function makeId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now() + "-" + Math.random();
}

function createTimestamp(dateValue, hour, minute, days = 0) {
  const date = parseDate(dateValue);
  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);
  return date.getTime();
}

// ===================================
// AGENDAWEERGAVE
// ===================================

function setView(nextView) {
  view = nextView;

  $("dayBtn").classList.toggle("active", view === "day");
  $("weekBtn").classList.toggle("active", view === "week");

  renderAgenda();
}

function changeDate(value) {
  if (!value) return;

  selectedDate = value;
  renderAgenda();
}

function moveDate(direction) {
  selectedDate = addDays(
    selectedDate,
    direction * (view === "week" ? 7 : 1)
  );
  renderAgenda();
}

function getWeekStart(value) {
  const date = parseDate(value);
  const day = (date.getDay() + 6) % 7;

  date.setDate(date.getDate() - day);
  return dateString(date);
}

function appointmentsForDay(day) {
  const start = createTimestamp(day, 0, 0);
  const end = createTimestamp(addDays(day, 1), 0, 0);

  return records
    .filter(item =>
      item.type === "agenda" &&
      item.start < end &&
      item.end > start
    )
    .sort((a, b) => a.start - b.start);
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);

  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;

  return element;
}

function renderDay(day, container) {
  const events = appointmentsForDay(day);

  if (view === "week") {
    const heading = createElement(
      "h3",
      day === dateString(new Date()) ? "today-heading" : "",
      formatDate(day)
    );
    container.appendChild(heading);
  }

  if (!events.length) {
    container.appendChild(
      createElement("p", "empty", "Geen afspraken")
    );
    return;
  }

  for (const item of events) {
    const event = createElement("div", "event");

    const time = createElement(
      "span",
      "event-time",
      formatTime(item.start) + " – " + formatTime(item.end)
    );

    const title = createElement(
      "strong",
      "event-title",
      item.name
    );

    const edit = createElement("button", "", "Bewerken");
    edit.addEventListener("click", () => editRecord(item.id));

    event.append(time, title, edit);
    container.appendChild(event);
  }
}

function renderAgenda() {
  $("viewDate").value = selectedDate;

  const agenda = $("agenda");
  agenda.replaceChildren();

  if (view === "day") {
    $("dateTitle").textContent = formatDate(selectedDate);
    renderDay(selectedDate, agenda);
    return;
  }

  const monday = getWeekStart(selectedDate);
  const sunday = addDays(monday, 6);

  $("dateTitle").textContent =
    formatDate(monday) + " – " + formatDate(sunday);

  for (let i = 0; i < 7; i++) {
    const day = addDays(monday, i);
    const section = createElement("div", "weekday");

    renderDay(day, section);
    agenda.appendChild(section);
  }
}

// ===================================
// TO-DO-LIJST
// ===================================

function renderTodos() {
  const container = $("todos");
  container.replaceChildren();

  const todos = records
    .filter(item => item.type === "todo")
    .sort((a, b) => Number(a.done) - Number(b.done));

  if (!todos.length) {
    container.appendChild(
      createElement("p", "empty", "Nog geen to-do's")
    );
    return;
  }

  for (const todo of todos) {
    const row = createElement(
      "div",
      "todo-item" + (todo.done ? " todo-done" : "")
    );

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(todo.done);

    checkbox.addEventListener("change", () => {
      todo.done = checkbox.checked;
      saveRecords();
    });

    const content = createElement("div", "todo-content");
    content.appendChild(createElement("strong", "", todo.name));

    const appointment = records.find(item =>
      item.type === "agenda" && item.todoId === todo.id
    );

    if (appointment) {
      content.appendChild(createElement(
        "small",
        "",
        formatDate(dateString(new Date(appointment.start))) +
          " · " + formatTime(appointment.start) +
          " – " + formatTime(appointment.end)
      ));
    }

    const actions = createElement("div", "todo-actions");

    const plan = createElement(
      "button",
      appointment ? "" : "active",
      appointment ? "Wijzig tijd" : "Plan in agenda"
    );

    plan.addEventListener("click", () => {
      if (appointment) {
        editRecord(appointment.id);
      } else {
        openForm("agenda", todo.id);
      }
    });

    const edit = createElement("button", "", "Bewerken");
    edit.addEventListener("click", () => editRecord(todo.id));

    actions.append(plan, edit);
    content.appendChild(actions);
    row.append(checkbox, content);

    container.appendChild(row);
  }
}

function render() {
  renderAgenda();
  renderTodos();
}

// ===================================
// FORMULIER
// ===================================

function openForm(type = "agenda", todoId = null) {
  editingId = null;
  linkedTodoId = todoId;

  $("formTitle").textContent = "TOEVOEGEN";
  $("name").value = "";
  $("entryDate").value = selectedDate;

  startHour = 9;
  startMinute = 0;
  endHour = 10;
  endMinute = 0;
  extraDays = 0;

  if (todoId) {
    const todo = records.find(item => item.id === todoId);
    if (todo) $("name").value = todo.name;
  }

  setType(type);
  selectPart("start");

  $("deleteButton").classList.add("hidden");
  $("overlay").classList.remove("hidden");

  document.body.style.overflow = "hidden";
  $("name").focus();
}

function closeForm() {
  $("overlay").classList.add("hidden");
  document.body.style.overflow = "";
}

function setType(type) {
  formType = type;

  $("typeAgenda").classList.toggle(
    "active", type === "agenda"
  );
  $("typeTodo").classList.toggle(
    "active", type === "todo"
  );

  $("timeFields").classList.toggle(
    "hidden", type === "todo"
  );

  // Een gekoppelde afspraak blijft een afspraak.
  $("typeTodo").disabled = Boolean(linkedTodoId);

  renderTimeButtons();
}

function quickDate(offset) {
  $("entryDate").value = addDays(
    dateString(new Date()), offset
  );
}

function selectPart(part) {
  activePart = part;

  $("startBtn").classList.toggle(
    "active", part === "start"
  );
  $("endBtn").classList.toggle(
    "active", part === "end"
  );

  $("extraArea").classList.toggle(
    "hidden", part !== "end"
  );

  renderTimeButtons();
}

function renderTimeButtons() {
  $("startText").textContent =
    pad(startHour) + ":" + pad(startMinute);

  $("endText").textContent =
    pad(endHour) + ":" + pad(endMinute);

  const hour = activePart === "start" ? startHour : endHour;
  const minute = activePart === "start"
    ? startMinute : endMinute;

  const hours = $("hours");
  const minutes = $("minutes");
  const days = $("extraDays");

  hours.replaceChildren();
  minutes.replaceChildren();
  days.replaceChildren();

  // Uren 07 t/m 24
  for (let h = 7; h <= 24; h++) {
    const button = createElement("button", "", pad(h));

    button.classList.toggle("active", h === hour);

    button.addEventListener("click", () => {
      if (activePart === "start") {
        startHour = h;
        if (h === 24) startMinute = 0;
      } else {
        endHour = h;
        if (h === 24) endMinute = 0;
      }

      renderTimeButtons();
    });

    hours.appendChild(button);
  }

  // Kwartieren
  for (const m of [0, 15, 30, 45]) {
    const button = createElement("button", "", pad(m));

    button.classList.toggle("active", m === minute);
    button.disabled = hour === 24 && m !== 0;

    button.addEventListener("click", () => {
      if (activePart === "start") {
        startMinute = m;
      } else {
        endMinute = m;
      }

      renderTimeButtons();
    });

    minutes.appendChild(button);
  }

  // Einddatum 0 t/m +7 dagen
  for (let d = 0; d <= 7; d++) {
    const button = createElement(
      "button", "", d === 0 ? "0" : "+" + d
    );

    button.classList.toggle("active", extraDays === d);

    button.addEventListener("click", () => {
      extraDays = d;
      renderTimeButtons();
    });

    days.appendChild(button);
  }
}

// ===================================
// BEWERKEN
// ===================================

function editRecord(id) {
  const item = records.find(record => record.id === id);
  if (!item) return;

  openForm(item.type, item.todoId || null);

  editingId = id;
  $("formTitle").textContent = "BEWERKEN";
  $("name").value = item.name;

  if (item.type === "agenda") {
    const start = new Date(item.start);
    const end = new Date(item.end);

    $("entryDate").value = dateString(start);

    startHour = start.getHours();
    startMinute = start.getMinutes();
    endHour = end.getHours();
    endMinute = end.getMinutes();

    const startDay = parseDate(dateString(start));
    const endDay = parseDate(dateString(end));

    extraDays = Math.round(
      (endDay - startDay) / 86400000
    );

    // In deze selector wordt 00:00 als 24:00 getoond.
    if (endHour === 0 && extraDays > 0) {
      endHour = 24;
      extraDays--;
    }

    selectPart("start");
  }

  $("deleteButton").classList.remove("hidden");
  renderTimeButtons();
}

// ===================================
// OPSLAAN EN VERWIJDEREN
// ===================================

function saveEntry() {
  const name = $("name").value.trim();

  if (!name) {
    alert("Vul eerst in wat je gaat doen.");
    $("name").focus();
    return;
  }

  let data;

  if (formType === "todo") {
    data = {
      type: "todo",
      name,
      done: false
    };
  } else {
    const date = $("entryDate").value;

    if (!date) {
      alert("Kies een datum.");
      return;
    }

    const start = createTimestamp(
      date, startHour, startMinute
    );

    const end = createTimestamp(
      date, endHour, endMinute, extraDays
    );

    if (end <= start) {
      alert("De eindtijd moet later zijn dan de begintijd.");
      return;
    }

    data = {
      type: "agenda",
      name,
      start,
      end,
      todoId: linkedTodoId || null
    };
  }

  if (editingId) {
    const index = records.findIndex(
      item => item.id === editingId
    );

    if (index !== -1) {
      const old = records[index];

      records[index] = {
        ...old,
        ...data
      };
    }
  } else {
    records.push({
      id: makeId(),
      ...data
    });
  }

  // Naam van gekoppelde to-do gelijk houden.
  if (data.todoId) {
    const todo = records.find(
      item => item.id === data.todoId
    );
    if (todo) todo.name = name;
  }

  saveRecords();
  closeForm();
}

function deleteEntry() {
  if (!editingId) return;

  if (!confirm("Weet je zeker dat je dit wilt verwijderen?")) {
    return;
  }

  const item = records.find(
    record => record.id === editingId
  );

  if (!item) return;

  records = records.filter(record => {
    if (record.id === editingId) return false;

    // Als een to-do wordt verwijderd, worden
    // gekoppelde agenda-afspraken ook verwijderd.
    if (item.type === "todo" && record.todoId === item.id) {
      return false;
    }

    return true;
  });

  saveRecords();
  closeForm();
}

// ===================================
// KNOPPEN KOPPELEN
// ===================================

$("dayBtn").addEventListener("click", () => setView("day"));
$("weekBtn").addEventListener("click", () => setView("week"));

$("previousDate").addEventListener(
  "click", () => moveDate(-1)
);
$("nextDate").addEventListener(
  "click", () => moveDate(1)
);

$("viewDate").addEventListener(
  "change", event => changeDate(event.target.value)
);

$("addButton").addEventListener(
  "click", () => openForm()
);
$("closeButton").addEventListener("click", closeForm);
$("cancelButton").addEventListener("click", closeForm);

$("typeAgenda").addEventListener(
  "click", () => setType("agenda")
);
$("typeTodo").addEventListener(
  "click", () => setType("todo")
);

$("startBtn").addEventListener(
  "click", () => selectPart("start")
);
$("endBtn").addEventListener(
  "click", () => selectPart("end")
);

document.querySelectorAll("[data-offset]").forEach(button => {
  button.addEventListener("click", () => {
    quickDate(Number(button.dataset.offset));
  });
});

$("saveButton").addEventListener("click", saveEntry);
$("deleteButton").addEventListener("click", deleteEntry);

// Eerste weergave
render();
