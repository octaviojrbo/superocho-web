const loginForm =
  document.getElementById("loginForm");

const loginMessage =
  document.getElementById("loginMessage");

if(loginForm){

  loginForm.addEventListener("submit", async (e) => {

    e.preventDefault();

    const email =
      document.getElementById("loginEmail").value.trim();

    const password =
      document.getElementById("loginPassword").value.trim();

    loginMessage.textContent =
      "Iniciando sesión...";

    const { error } =
      await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

    if(error){
      console.error(error);
      loginMessage.textContent =
        "Correo o contraseña incorrectos.";
      return;
    }

    window.location.href =
      "admin.html";

  });

}