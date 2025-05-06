export function showRehiddenNotification(walnutId: string) {
  const div = document.createElement("div");
  div.textContent = `A walnut was rehidden! (ID: ${walnutId})`;
  div.style.position = "absolute";
  div.style.top = "20px";
  div.style.left = "50%";
  div.style.transform = "translateX(-50%)";
  div.style.padding = "10px 20px";
  div.style.background = "#333";
  div.style.color = "#fff";
  div.style.borderRadius = "8px";
  div.style.fontSize = "16px";
  div.style.zIndex = "1000";
  div.style.opacity = "0.9";
  document.body.appendChild(div);

  setTimeout(() => {
    div.remove();
  }, 3000);
} 