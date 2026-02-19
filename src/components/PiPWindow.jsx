import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export default function PiPWindow({ pipWindow, children }) {
  const [container, setContainer] = useState(null);

  useEffect(() => {
    if (!pipWindow) return;

    // 1. Copy styles from main window to PiP window
    const styleElements = document.querySelectorAll('style, link[rel="stylesheet"]');
    styleElements.forEach(element => {
      pipWindow.document.head.appendChild(element.cloneNode(true));
    });

    // 2. Copy body classes (important for theme)
    // eslint-disable-next-line
    pipWindow.document.body.className = document.body.className;

    // 3. Create a container inside the PiP body where React will render
    const div = pipWindow.document.createElement('div');
    // Ensure the container takes full height and uses base styles
    div.className = "h-full w-full flex flex-col items-center justify-center bg-neutral-900 text-white";
    pipWindow.document.body.appendChild(div);
    setContainer(div);

    // 4. Cleanup when component unmounts or window changes
    return () => {
      // No strict need to remove styles as window closes, but good practice
    };
  }, [pipWindow]);

  if (!container) return null;

  return createPortal(children, container);
}
