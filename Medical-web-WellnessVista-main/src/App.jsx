import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./components/Home";
import About from "./components/About";
import Services from "./components/Services";
import Doctors from "./components/Doctors";
import Blogs from "./components/Blogs";
import Footer from "./components/Footer";
import SignInPage from "./pages/SignInPage";
import RegisterPage from "./pages/RegisterPage";
import CollectorSignInPage from "./pages/CollectorSignInPage";
import CollectorRegisterPage from "./pages/CollectorRegisterPage";
import RecyclerSignInPage from "./pages/RecyclerSignInPage";
import RecyclerRegisterPage from "./pages/RecyclerRegisterPage";

const MainLayout = () => {
  return (
    <div>
      <Navbar />
      <main>
        <div id="home">
          <Home />
        </div>
        <div id="about">
          <About />
        </div>
        <div id="services">
          <Services />
        </div>
        <div id="doctors">
          <Doctors />
        </div>
        <div id="blog">
          <Blogs />
        </div>
      </main>
      <Footer />
    </div>
  );
};

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainLayout />} />
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/collector-signin" element={<CollectorSignInPage />} />
        <Route path="/collector-register" element={<CollectorRegisterPage />} />
        <Route path="/recycler-signin" element={<RecyclerSignInPage />} />
        <Route path="/recycler-register" element={<RecyclerRegisterPage />} />
      </Routes>
    </Router>
  );
};

export default App;
