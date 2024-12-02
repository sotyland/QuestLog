import React, { useState } from 'react';
import Task from './Task';

const TaskList = ({ tasks, removeTask, completeTask, isCompleted, addTask }) => {
  const [quickTaskInput, setQuickTaskInput] = useState('');

  const handleQuickAdd = (e) => {
    if (e.key === 'Enter' && quickTaskInput.trim()) {
      addTask({
        name: quickTaskInput.trim(),
        desc: '',
        difficulty: 5,
        importance: 5,
        deadline: null,
        collaborative: false,
        experience: 150
      });
      setQuickTaskInput('');
    }
  };

  const sortedTasks = [...tasks].sort((a, b) => {
    // Tasks without deadlines go last
    if (!a.deadline && !b.deadline) return 0;
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    return new Date(a.deadline) - new Date(b.deadline);
  });

  // Group tasks by date
  const groupedTasks = sortedTasks.reduce((groups, task) => {
    if (!task.deadline) {
      if (!groups['No due date']) groups['No due date'] = [];
      groups['No due date'].push(task);
    } else {
      const dateObj = new Date(task.deadline);
      const userTimezoneOffset = dateObj.getTimezoneOffset() * 60000;
      const adjustedDate = new Date(dateObj.getTime() + userTimezoneOffset);
      
      const date = adjustedDate.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      if (!groups[date]) groups[date] = [];
      groups[date].push(task);
    }
    return groups;
  }, {});

  const sortedGroups = Object.entries(groupedTasks).sort(([dateA], [dateB]) => {
    if (dateA === 'No due date') return 1;
    if (dateB === 'No due date') return -1;
    if (dateA !== 'No due date' && dateB !== 'No due date') {
      return new Date(tasks.find(t => t.deadline && new Date(t.deadline).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }) === dateA).deadline) - 
      new Date(tasks.find(t => t.deadline && new Date(t.deadline).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }) === dateB).deadline);
    }
    return 0;
  });

  return (
    <div className="flex flex-col items-center w-full bg-white dark:bg-gray-800 rounded-lg p-6 transition-colors duration-200">
      <div className="flex items-center justify-between w-full mb-6">
        {!isCompleted ? (
          <div className="relative w-64">
            <input
              type="text"
              placeholder="Quick add (150 XP)"
              value={quickTaskInput}
              onChange={(e) => setQuickTaskInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleQuickAdd(e);
                }
              }}
              className="w-full px-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 
                       dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 
                       placeholder-gray-400 dark:placeholder-gray-500"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
              press ⏎
            </div>
          </div>
        ) : (
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 w-full text-center">
            Completed
          </h2>
        )}
      </div>
      
      <ul className="space-y-8 w-full flex flex-col items-center">
        {sortedGroups.map(([date, dateTasks]) => (
          <li key={date} className="w-full flex flex-col items-center space-y-2">
            <div className="w-11/12 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
              {date}
            </div>
            <div className="w-full flex flex-col items-center">
              {dateTasks.map((task) => (
                <Task
                  key={task.id}
                  task={task}
                  removeTask={removeTask}
                  completeTask={completeTask}
                  isCompleted={isCompleted}
                />
              ))}
            </div>
          </li>
        ))}
        {!isCompleted && sortedTasks.length === 0 && (
          <li className="text-center text-gray-500 dark:text-gray-400 py-8">
            Type above for quick task or use New Task for more options
          </li>
        )}
      </ul>
    </div>
  );
};

export default TaskList;