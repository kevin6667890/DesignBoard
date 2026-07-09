import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Interview from './pages/Interview';
import History from './pages/History';
import CustomPlanner from './pages/CustomPlanner';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/custom" element={<CustomPlanner />} />
        <Route path="/interview/:sessionId" element={<Interview />} />
        <Route path="/history" element={<History />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
