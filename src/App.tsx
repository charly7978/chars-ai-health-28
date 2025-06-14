import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import NewMeasurements from "./components/NewMeasurements";

const App = () => {
  return (
    <Router>
      <div className="App">
        <h1 className="text-2xl font-bold text-center">Mediciones Avanzadas</h1>
        <NewMeasurements />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
