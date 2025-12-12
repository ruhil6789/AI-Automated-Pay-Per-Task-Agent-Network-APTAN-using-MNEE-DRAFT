import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import CreateTask from './pages/CreateTask';
import Tasks from './pages/Tasks';
import TaskDetail from './pages/TaskDetail';

function App() {
  return (
    <Router>
      <div className="App">
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/create-task" element={<CreateTask />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/task/:id" element={<TaskDetail />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

