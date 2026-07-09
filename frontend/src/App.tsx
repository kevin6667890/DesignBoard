import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Interview from './pages/Interview';
import History from './pages/History';
import CustomPlanner from './pages/CustomPlanner';
import CareerHome from './pages/CareerHome';
import CareerProfile from './pages/CareerProfile';
import CareerJobForm from './pages/CareerJobForm';
import CareerJobs from './pages/CareerJobs';
import CareerJobDetail from './pages/CareerJobDetail';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/custom" element={<CustomPlanner />} />
        <Route path="/career" element={<CareerHome />} />
        <Route path="/career/profile" element={<CareerProfile />} />
        <Route path="/career/jobs" element={<CareerJobs />} />
        <Route path="/career/jobs/new" element={<CareerJobForm />} />
        <Route path="/career/jobs/:jobId" element={<CareerJobDetail />} />
        <Route path="/interview/:sessionId" element={<Interview />} />
        <Route path="/history" element={<History />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
