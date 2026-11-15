/* Personal task list: static page, data kept in this browser's localStorage. */
(() => {
  'use strict';

  const ITEMS_KEY = 'sillyberg.tasklist.v1';
  const THEME_KEY = 'sillyberg.tasklist.theme';
  const SCHEMA_VERSION = 1;
  const MAX_TITLE = 200;
  const TOAST_MS = 6000;

  const el = {
    form: document.getElementById('task-form'),
    title: document.getElementById('task-title'),
    due: document.getElementById('task-due'),
    priority: document.getElementById('task-priority'),
    list: document.getElementById('task-list'),
    empty: document.getElementById('empty-state'),
    emptyText: document.getElementById('empty-text'),
    filterButtons: Array.from(document.querySelectorAll('.filter')),
    countEls: Array.from(document.querySelectorAll('[data-count]')),
    search: document.getElementById('search'),
    summary: document.getElementById('summary'),
    clearCompleted: document.getElementById('clear-completed'),
    todayLabel: document.getElementById('today-label'),
    themeToggle: document.getElementById('theme-toggle'),
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toast-message'),
    toastAction: document.getElementById('toast-action'),
  };

  let items = loadItems();
  let filter = 'all';
  let query = '';
  let toastTimer = 0;
  let toastCallback = null;
  let storageWarned = false;

  /* Date helpers ---------------------------------------------------------- */

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  function dateKey(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function parseDateKey(key) {
    if (typeof key !== 'string') return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      return null;
    }
    return date;
  }

  function dayNumber(date) {
    return Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
  }

  function daysFromToday(date) {
    return dayNumber(date) - dayNumber(new Date());
  }

  function formatDate(date) {
    const month = `${date.getMonth() + 1}月${date.getDate()}日`;
    return date.getFullYear() === new Date().getFullYear()
      ? month
      : `${date.getFullYear()}年${month}`;
  }

  function formatToday() {
    const now = new Date();
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 · 周${weekdays[now.getDay()]}`;
  }

  /* Storage --------------------------------------------------------------- */

  function newId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  }

  function normalizeItem(raw) {
    if (!raw || typeof raw !== 'object' || typeof raw.title !== 'string') return null;
    const title = raw.title.trim().slice(0, MAX_TITLE);
    if (!title) return null;
    const priority = raw.priority === 'high' || raw.priority === 'low' ? raw.priority : 'normal';
    const due = parseDateKey(raw.due) ? raw.due : '';
    return {
      id: typeof raw.id === 'string' && raw.id ? raw.id : newId(),
      title,
      done: raw.done === true,
      priority,
      due,
      createdAt: Number.isFinite(raw.createdAt) ? raw.createdAt : Date.now(),
      updatedAt: Number.isFinite(raw.updatedAt) ? raw.updatedAt : Date.now(),
    };
  }

  function loadItems() {
    let raw = null;
    try {
      raw = localStorage.getItem(ITEMS_KEY);
    } catch (error) {
      console.warn('浏览器存储不可用，任务将只保存在当前页面。', error);
      return [];
    }
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed)
        ? parsed
        : parsed && Array.isArray(parsed.items)
          ? parsed.items
          : [];
      return list.map(normalizeItem).filter(Boolean);
    } catch (error) {
      console.warn('读取本地任务失败，已从空列表开始。', error);
      return [];
    }
  }

  function saveItems() {
    try {
      localStorage.setItem(ITEMS_KEY, JSON.stringify({ version: SCHEMA_VERSION, items }));
      return true;
    } catch (error) {
      console.warn('保存任务失败，浏览器存储可能已满或被禁用。', error);
      if (!storageWarned) {
        storageWarned = true;
        showToast('浏览器存储不可用，刷新页面后任务可能会丢失。');
      }
      return false;
    }
  }

  /* Task lookups ---------------------------------------------------------- */

  function findItem(id) {
    return items.find((item) => item.id === id) || null;
  }

  function findRow(id) {
    for (const row of el.list.children) {
      if (row.dataset.id === id) return row;
    }
    return null;
  }

  function isVisible(item) {
    if (filter === 'active' && item.done) return false;
    if (filter === 'done' && !item.done) return false;
    if (filter === 'today' && (item.done || !item.due || item.due > dateKey(new Date()))) return false;
    if (query && !item.title.toLowerCase().includes(query)) return false;
    return true;
  }

  function visibleItems() {
    return items.filter(isVisible);
  }

  function countItems() {
    const today = dateKey(new Date());
    let done = 0;
    let dueToday = 0;
    let overdue = 0;
    for (const item of items) {
      if (item.done) {
        done += 1;
        continue;
      }
      if (item.due) {
        if (item.due < today) overdue += 1;
        if (item.due <= today) dueToday += 1;
      }
    }
    return {
      total: items.length,
      active: items.length - done,
      done,
      dueToday,
      overdue,
    };
  }

  function dueInfo(item) {
    const date = parseDateKey(item.due);
    if (!date) return null;
    const diff = daysFromToday(date);
    if (item.done) {
      return { label: formatDate(date), kind: 'done', title: `截止日期：${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日` };
    }
    if (diff < 0) {
      return { label: `逾期 ${Math.abs(diff)} 天`, kind: 'overdue', title: `截止日期：${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日` };
    }
    if (diff === 0) {
      return { label: '今天到期', kind: 'today', title: `截止日期：${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日` };
    }
    if (diff === 1) {
      return { label: '明天到期', kind: 'soon', title: `截止日期：${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日` };
    }
    return {
      label: formatDate(date),
      kind: diff <= 7 ? 'soon' : 'later',
      title: `截止日期：${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`,
    };
  }

  /* Rendering ------------------------------------------------------------- */

  function captureFocus() {
    const active = document.activeElement;
    if (!active || !active.closest) return null;
    const row = active.closest('.task');
    if (!row || !row.dataset.id) return null;
    let kind = 'title';
    if (active.classList.contains('task__check')) kind = 'check';
    else if (active.classList.contains('task__edit')) kind = 'edit';
    else if (active.classList.contains('task__delete')) kind = 'delete';
    return { id: row.dataset.id, kind };
  }

  function restoreFocus(focus) {
    if (!focus) return;
    const row = findRow(focus.id);
    if (row) {
      const selectors = {
        check: '.task__check',
        title: '.task__title',
        edit: '.task__edit',
        delete: '.task__delete',
      };
      const target = row.querySelector(selectors[focus.kind] || '.task__title');
      if (target) {
        target.focus({ preventScroll: true });
        return;
      }
    }
    const firstTask = el.list.querySelector('.task__title');
    if (firstTask) {
      firstTask.focus({ preventScroll: true });
      return;
    }
    const activeFilter = el.filterButtons.find((button) => button.dataset.filter === filter);
    if (activeFilter) activeFilter.focus({ preventScroll: true });
  }

  function buildTask(item) {
    const row = document.createElement('li');
    row.className = item.done ? 'task is-done' : 'task';
    row.dataset.id = item.id;

    const checkWrap = document.createElement('label');
    checkWrap.className = 'task__check-wrap';
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.className = 'task__check';
    check.checked = item.done;
    check.setAttribute('aria-label', item.done ? `将「${item.title}」标记为未完成` : `将「${item.title}」标记为已完成`);
    const box = document.createElement('span');
    box.className = 'task__box';
    box.setAttribute('aria-hidden', 'true');
    checkWrap.append(check, box);

    const body = document.createElement('div');
    body.className = 'task__body';

    const title = document.createElement('span');
    title.className = 'task__title';
    title.tabIndex = 0;
    title.setAttribute('role', 'button');
    title.setAttribute('aria-label', `编辑任务：${item.title}`);
    title.title = '双击或按回车编辑';
    title.textContent = item.title;
    body.appendChild(title);

    const due = dueInfo(item);
    const high = item.priority === 'high';
    const low = item.priority === 'low';
    if (due || high || low) {
      const meta = document.createElement('div');
      meta.className = 'task__meta';
      if (due) {
        const badge = document.createElement('span');
        badge.className = `badge task__due--${due.kind}`;
        badge.title = due.title;
        badge.textContent = due.label;
        meta.appendChild(badge);
      }
      if (high) {
        const badge = document.createElement('span');
        badge.className = 'badge priority--high';
        badge.textContent = '重要';
        meta.appendChild(badge);
      } else if (low) {
        const badge = document.createElement('span');
        badge.className = 'badge priority--low';
        badge.textContent = '低优先级';
        meta.appendChild(badge);
      }
      body.appendChild(meta);
    }

    const actions = document.createElement('div');
    actions.className = 'task__actions';

    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'task__edit';
    edit.title = '编辑任务';
    edit.setAttribute('aria-label', `编辑任务：${item.title}`);
    edit.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z"></path><path d="m13.5 6.5 3 3"></path></svg>';

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'task__delete';
    remove.title = '删除任务';
    remove.setAttribute('aria-label', `删除任务：${item.title}`);
    remove.textContent = '×';

    actions.append(edit, remove);
    row.append(checkWrap, body, actions);
    return row;
  }

  function summaryText(counts) {
    if (counts.total === 0) return '还没有任务';
    const parts = [`${counts.active} 项未完成`, `已完成 ${counts.done} 项`];
    if (counts.overdue > 0) parts.push(`逾期 ${counts.overdue} 项`);
    return parts.join(' · ');
  }

  function emptyText(counts) {
    if (query) return `没有找到包含「${query}」的任务。`;
    if (counts.total === 0) return '添加第一件要做的事吧。';
    if (filter === 'active') return '没有未完成的任务，休息一下吧。';
    if (filter === 'done') return '还没有已完成的任务。';
    if (filter === 'today') return '今天没有到期或逾期的任务。';
    return '没有符合条件的任务。';
  }

  function render() {
    const focus = captureFocus();
    const counts = countItems();

    for (const button of el.filterButtons) {
      const active = button.dataset.filter === filter;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    }

    for (const count of el.countEls) {
      count.textContent = String(counts[count.dataset.count] || 0);
    }

    const visible = visibleItems();
    const fragment = document.createDocumentFragment();
    for (const item of visible) fragment.appendChild(buildTask(item));
    el.list.replaceChildren(fragment);

    el.empty.hidden = visible.length !== 0;
    if (visible.length === 0) el.emptyText.textContent = emptyText(counts);
    el.summary.textContent = summaryText(counts);
    el.clearCompleted.disabled = counts.done === 0;
    el.todayLabel.textContent = formatToday();

    restoreFocus(focus);
  }

  /* Mutations ------------------------------------------------------------- */

  function addTask(title, due, priority) {
    const item = {
      id: newId(),
      title: title.trim().slice(0, MAX_TITLE),
      done: false,
      priority: priority === 'high' || priority === 'low' ? priority : 'normal',
      due: parseDateKey(due) ? due : '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    items.unshift(item);
    saveItems();
    if (!isVisible(item)) {
      filter = 'all';
      query = '';
      el.search.value = '';
    }
    render();
  }

  function toggleTask(id) {
    const item = findItem(id);
    if (!item) return;
    item.done = !item.done;
    item.updatedAt = Date.now();
    saveItems();
    render();
  }

  function deleteTask(id) {
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) return;
    const removed = items[index];
    items.splice(index, 1);
    saveItems();
    render();
    showToast(`已删除「${removed.title}」`, '撤销', () => {
      if (findItem(removed.id)) return;
      items.splice(Math.min(index, items.length), 0, removed);
      saveItems();
      render();
      showToast(`已恢复「${removed.title}」`);
    });
  }

  function clearCompleted() {
    const completed = items.filter((item) => item.done);
    if (completed.length === 0) return;
    items = items.filter((item) => !item.done);
    saveItems();
    render();
    showToast(`已清除 ${completed.length} 项已完成任务`);
  }

  function renameTask(id, title) {
    const item = findItem(id);
    if (!item) return;
    const next = title.trim().slice(0, MAX_TITLE);
    if (next && next !== item.title) {
      item.title = next;
      item.updatedAt = Date.now();
      saveItems();
    }
    render();
  }

  function startEditing(id) {
    const row = findRow(id);
    if (!row) return;
    const title = row.querySelector('.task__title');
    if (!title) return;
    const item = findItem(id);
    if (!item) return;

    const editor = document.createElement('input');
    editor.type = 'text';
    editor.className = 'task__editor';
    editor.value = item.title;
    editor.maxLength = MAX_TITLE;
    editor.setAttribute('aria-label', '编辑任务内容');

    title.replaceWith(editor);
    editor.focus();
    editor.select();

    let settled = false;
    const finish = (commit) => {
      if (settled) return;
      settled = true;
      if (commit) renameTask(id, editor.value);
      else render();
    };

    editor.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        finish(true);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        finish(false);
      }
    });
    editor.addEventListener('blur', () => window.setTimeout(() => finish(true), 0));
  }

  /* Toast ----------------------------------------------------------------- */

  function hideToast() {
    window.clearTimeout(toastTimer);
    toastTimer = 0;
    toastCallback = null;
    el.toast.hidden = true;
  }

  function showToast(message, actionLabel, action) {
    window.clearTimeout(toastTimer);
    toastCallback = typeof action === 'function' ? action : null;
    el.toastMessage.textContent = message;
    if (toastCallback && actionLabel) {
      el.toastAction.textContent = actionLabel;
      el.toastAction.hidden = false;
    } else {
      el.toastAction.hidden = true;
      el.toastAction.textContent = '';
    }
    el.toast.hidden = false;
    toastTimer = window.setTimeout(hideToast, TOAST_MS);
  }

  /* Theme ----------------------------------------------------------------- */

  function applyTheme(theme, persist) {
    const dark = theme === 'dark';
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    if (persist) {
      try {
        localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
      } catch (error) {
        console.warn('无法保存主题设置。', error);
      }
    }
    const next = dark ? '浅色' : '深色';
    el.themeToggle.setAttribute('aria-label', `切换到${next}模式`);
    el.themeToggle.title = `切换到${next}模式`;
  }

  function currentTheme() {
    return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  }

  function storedTheme() {
    try {
      const value = localStorage.getItem(THEME_KEY);
      return value === 'dark' || value === 'light' ? value : null;
    } catch (error) {
      return null;
    }
  }

  /* Events ---------------------------------------------------------------- */

  el.form.addEventListener('submit', (event) => {
    event.preventDefault();
    const title = el.title.value.trim();
    if (!title) {
      el.title.reportValidity();
      return;
    }
    addTask(title, el.due.value, el.priority.value);
    el.title.value = '';
    el.due.value = '';
    el.priority.value = 'normal';
    el.title.focus();
  });

  el.list.addEventListener('change', (event) => {
    const check = event.target.closest('.task__check');
    if (!check) return;
    const row = check.closest('.task');
    if (row) toggleTask(row.dataset.id);
  });

  el.list.addEventListener('click', (event) => {
    const edit = event.target.closest('.task__edit');
    if (edit) {
      const row = edit.closest('.task');
      if (row) startEditing(row.dataset.id);
      return;
    }
    const remove = event.target.closest('.task__delete');
    if (remove) {
      const row = remove.closest('.task');
      if (row) deleteTask(row.dataset.id);
    }
  });

  el.list.addEventListener('dblclick', (event) => {
    const title = event.target.closest('.task__title');
    if (!title) return;
    const row = title.closest('.task');
    if (row) startEditing(row.dataset.id);
  });

  el.list.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const title = event.target.closest('.task__title');
    if (!title) return;
    event.preventDefault();
    const row = title.closest('.task');
    if (row) startEditing(row.dataset.id);
  });

  el.filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      filter = button.dataset.filter || 'all';
      render();
    });
  });

  el.search.addEventListener('input', () => {
    query = el.search.value.trim().toLowerCase();
    render();
  });

  el.clearCompleted.addEventListener('click', clearCompleted);

  el.themeToggle.addEventListener('click', () => {
    applyTheme(currentTheme() === 'dark' ? 'light' : 'dark', true);
  });

  el.toastAction.addEventListener('click', () => {
    const callback = toastCallback;
    hideToast();
    if (callback) callback();
  });

  window.addEventListener('storage', (event) => {
    if (event.key === ITEMS_KEY || event.key === null) {
      items = loadItems();
      render();
    } else if (event.key === THEME_KEY) {
      const stored = storedTheme();
      if (stored) applyTheme(stored, false);
      else applyTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light', false);
    }
  });

  const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');
  if (typeof colorScheme.addEventListener === 'function') {
    colorScheme.addEventListener('change', (event) => {
      if (!storedTheme()) applyTheme(event.matches ? 'dark' : 'light', false);
    });
  }

  /* Init ------------------------------------------------------------------ */

  applyTheme(currentTheme(), false);
  el.todayLabel.textContent = formatToday();
  render();
})();
