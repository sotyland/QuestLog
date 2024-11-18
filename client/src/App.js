import './styles/globals.css';
import React, { useState, useEffect } from 'react';
import { CSSTransition, SwitchTransition } from 'react-transition-group';
import { v4 as uuidv4 } from 'uuid';
import { Analytics } from '@vercel/analytics/react';
import Header from './components/Header';
import ProgressBar from './components/ProgressBar';
import TaskButtons from './components/TaskButtons';
import TaskForm from './components/TaskForm';
import TaskList from './components/TaskList';
import LevelUpModal from './components/LevelUpModal';
import StreakTracker from './components/StreakTracker';
import Leaderboard from './components/Leaderboard';
import useXPManager from './components/XPManager';
import ThemeToggle from './components/ThemeToggle';
import Auth from './components/Auth';
import { GoogleOAuthProvider } from '@react-oauth/google';

const API_BASE_URL = process.env.REACT_APP_PROD || 'http://localhost:3001/api';

const App = () => {
  const [isDark, setIsDark] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [completedTasks, setCompletedTasks] = useState([]);
  const [showCompleted, setShowCompleted] = useState(false);
  const [userId, setUserId] = useState(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [error, setError] = useState(null);
  const [currentView, setCurrentView] = useState('todo');
  const [authToken, setAuthToken] = useState(null);


  const handleAuthChange = (token, id) => {
    setAuthToken(token);
    setUserId(id);
  };

  const handleLogout = () => {
    // Reset all state
    setTasks([]);
    setCompletedTasks([]);
    resetXP();
    setError(null);
    setShowLeaderboard(false);
    setCurrentView('todo');
  };

  const handleUserDataLoad = (userData) => {
    // Update XP and level
    const loadedXP = userData.xp || 0;    
    // Force refresh of XP manager
    resetXP();
    calculateXP(loadedXP);
    
    // Load tasks
    if (userData.tasks) {
      setTasks(userData.tasks);
      localStorage.setItem('tasks', JSON.stringify(userData.tasks));
    }
    
    if (userData.completedTasks) {
      setCompletedTasks(userData.completedTasks);
      localStorage.setItem('completedtasks', JSON.stringify(userData.completedTasks));
    }
  };

  const {
    level,
    experience,
    showLevelUp,
    newLevel,
    calculateXP,
    resetXP,
    setShowLevelUp,
    getTotalXP
  } = useXPManager();

  useEffect(() => {
    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    setIsDark(!isDark);
    if (!isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };


  const initializeUser = async () => {
    // Load local storage data for all users
    const savedTasks = localStorage.getItem('tasks');
    const savedCompletedTasks = localStorage.getItem('completedtasks');
  
    if (savedTasks) {
      setTasks(JSON.parse(savedTasks));
    }
  
    if (savedCompletedTasks) {
      setCompletedTasks(JSON.parse(savedCompletedTasks));
    }
  
    // Only make API call if authenticated
    if (authToken && userId) {
      try {
        const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            xp: getTotalXP(),
            level: level,
            tasksCompleted: completedTasks?.length || 0
          }),
        });
  
        if (!response.ok) {
          throw new Error(`Failed to update user: ${response.status}`);
        }
      } catch (error) {
        console.error('Error during initialization:', error);
        setError(error.message);
      }
    }
  };
  

// Update the useEffect to handle both authenticated and non-authenticated cases
useEffect(() => {
  initializeUser();
}, [authToken]); // eslint-disable-line react-hooks/exhaustive-deps


useEffect(() => {
  // Skip update if user is not authenticated
  if (!userId || !authToken) {
    return;
  }

  const updateUserData = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          xp: getTotalXP(),
          level: level,
          tasksCompleted: completedTasks.length,
          tasks: tasks,
          completedTasks: completedTasks
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update user data: ${response.status}`);
      }
    } catch (error) {
      console.error('Error updating user data:', error);
      setError(`Failed to update user data: ${error.message}`);
    }
  };

  updateUserData();
}, [userId, authToken, tasks, completedTasks, experience, level]); // eslint-disable-line react-hooks/exhaustive-deps

const addTask = async (taskData) => {
  try {
    const newTask = {
      ...taskData,
      id: uuidv4(),
      createdAt: new Date().toISOString()
    };
    
    const updatedTasks = [...tasks, newTask];
    setTasks(updatedTasks);
    localStorage.setItem('tasks', JSON.stringify(updatedTasks));

    // Only update server if authenticated
    if (userId && authToken) {
      await fetch(`${API_BASE_URL}/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          xp: getTotalXP(),
          level: level,
          tasksCompleted: completedTasks.length
        }),
      });
    }
  } catch (error) {
    console.error('Error adding task:', error);
    setError(error.message);
  }
};

const completeTask = async (task) => {
  try {
    const updatedTasks = tasks.filter(t => t.id !== task.id);
    const completedTask = {
      ...task,
      completedAt: new Date().toISOString()
    };
    const updatedCompletedTasks = [...completedTasks, completedTask];
  
    // Calculate XP and get the results
    const xpResult = calculateXP(task.experience);
      
    setTasks(updatedTasks);
    setCompletedTasks(updatedCompletedTasks);
  
    localStorage.setItem('tasks', JSON.stringify(updatedTasks));
    localStorage.setItem('completedtasks', JSON.stringify(updatedCompletedTasks));
  
    // Update the database with the correct total XP
    if (userId && authToken) {
      await fetch(`${API_BASE_URL}/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          xp: xpResult.totalExperience, // Use the total XP directly
          level: xpResult.currentLevel,
          tasksCompleted: updatedCompletedTasks.length,
          tasks: updatedTasks,
          completedTasks: updatedCompletedTasks
        }),
      });
    }
  } catch (error) {
    console.error('Error completing task:', error);
    setError(error.message);
  }
};

const removeTask = async (taskId, isCompleted) => {
  try {
    let updatedTasks = tasks;
    let updatedCompletedTasks = completedTasks;
    let xpToSubtract = 0;

    if (isCompleted) {
      // Find the task being removed to get its XP value
      const taskToRemove = completedTasks.find(t => t.id === taskId);
      if (taskToRemove) {
        xpToSubtract = taskToRemove.experience;
      }
      
      updatedCompletedTasks = completedTasks.filter(t => t.id !== taskId);
      setCompletedTasks(updatedCompletedTasks);
      localStorage.setItem('completedtasks', JSON.stringify(updatedCompletedTasks));
      
      // Subtract XP when removing a completed task
      if (xpToSubtract > 0) {
        calculateXP(-xpToSubtract); // Use negative value to subtract XP
      }
    } else {
      updatedTasks = tasks.filter(t => t.id !== taskId);
      setTasks(updatedTasks);
      localStorage.setItem('tasks', JSON.stringify(updatedTasks));
    }

    // Update server if user is authenticated
    if (userId && authToken) {
      await fetch(`${API_BASE_URL}/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          xp: getTotalXP(), // This will now reflect the subtracted XP
          level: level,
          tasksCompleted: updatedCompletedTasks.length,
          tasks: updatedTasks,
          completedTasks: updatedCompletedTasks
        }),
      });
    }
  } catch (error) {
    console.error('Error removing task:', error);
    setError(error.message);
  }
};


  const clearAllData = async () => {
    // Clear local storage for all users
    localStorage.removeItem('tasks');
    localStorage.removeItem('completedtasks');
    localStorage.removeItem('experience');
    localStorage.removeItem('level');
    
    setTasks([]);
    setCompletedTasks([]);
    const { level: resetLevel, experience: resetExp } = resetXP();
  
    // Only update database if authenticated
    if (userId && authToken) {
      try {
        const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({
            xp: resetExp,
            level: resetLevel, 
            tasksCompleted: 0,
          }),
        });
  
        if (!response.ok) {
          throw new Error(`Failed to reset user data: ${response.status}`);
        }
      } catch (error) {
        console.error('Error clearing data:', error);
        setError(error.message);
      }
    }
  };

  const toggleLeaderboard = () => {
    setShowLeaderboard(!showLeaderboard);
    setCurrentView(showLeaderboard ? 'todo' : 'leaderboard');
  };

  const handleShowCompleted = () => {
    setShowCompleted(true);
    setShowLeaderboard(false);
    setCurrentView('completed');
  };
  const handleShowTodo = () => {
    setShowCompleted(false);
    setShowLeaderboard(false);
    setCurrentView('todo');
  };

  return (
    <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID}>
      <div className="relative min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
        {/* Split the top controls into left and right sections */}
        <div className="fixed top-4 w-full flex justify-between px-4">
          <div className="flex items-center">
          <Auth 
              onAuthChange={handleAuthChange} 
              onUserDataLoad={handleUserDataLoad}
              onLogout={handleLogout}
            />
          </div>
          <div>
            <ThemeToggle isDark={isDark} onToggle={toggleTheme} />
          </div>
        </div>
      <Header />
      {error && (
        <div className="mx-4 my-2 p-4 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 rounded">
          Error: {error}
        </div>
      )}
      <div className="relative max-w-4xl mx-auto px-4 py-6 space-y-6">
        <ProgressBar level={level} experience={experience} />
        <StreakTracker tasks={tasks} completedTasks={completedTasks} />
        
        <CSSTransition
          in={!showLeaderboard}
          timeout={300}
          classNames="fade"
          unmountOnExit
        >
          <div>
            <TaskButtons 
              showCompleted={showCompleted} 
              setShowCompleted={handleShowCompleted}
              setShowTodo={handleShowTodo}
            />
            <TaskForm addTask={addTask} />
          </div>
        </CSSTransition>

        <div className="flex justify-between gap-4">
          <button 
            onClick={toggleLeaderboard}
            className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 font-bold text-lg border-3 border-gray-800 dark:border-gray-200 
                     text-gray-800 dark:text-gray-200 shadow-[4px_4px_#77dd77] hover:shadow-none hover:translate-x-1 
                     hover:translate-y-1 transition-all duration-200 rounded-none"
          >
            {showLeaderboard ? 'Hide Leaderboard' : 'Show Leaderboard'}
          </button>
          <button 
            onClick={clearAllData}
            className="px-3 py-2 bg-white dark:bg-gray-800 font-bold text-lg border-3 border-gray-800 dark:border-gray-200 
                     text-gray-800 dark:text-gray-200 shadow-[4px_4px_#77dd77] hover:shadow-none hover:translate-x-1 
                     hover:translate-y-1 transition-all duration-200 rounded-none"
          >
            Clear All Data
          </button>
        </div>
        
        <div className="relative z-0 overflow-hidden">
          <SwitchTransition mode="out-in">
            <CSSTransition
              key={currentView}
              classNames="slide"
              timeout={300}
              unmountOnExit
            >
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 transition-colors duration-200">
                {currentView === 'leaderboard' && <Leaderboard />}
                {currentView === 'todo' && (
                  <TaskList 
                    tasks={tasks} 
                    removeTask={removeTask}
                    completeTask={completeTask}
                    isCompleted={false}
                  />
                )}
                {currentView === 'completed' && (
                  <TaskList 
                    tasks={completedTasks} 
                    removeTask={removeTask}
                    completeTask={completeTask}
                    isCompleted={true}
                  />
                )}
              </div>
            </CSSTransition>
          </SwitchTransition>
        </div>
      </div>

      {}
      <LevelUpModal 
        show={showLevelUp}
        onClose={() => setShowLevelUp(false)} 
        level={newLevel}
      />
      <Analytics />
    </div>
    </GoogleOAuthProvider>
  );
};

export default App;