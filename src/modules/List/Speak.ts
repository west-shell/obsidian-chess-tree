import { registerListModule } from '../../core/module-system';
import type { IListHost } from '../../types';
import { speak } from '../speak';

const SpeakerModule = {
  init(host: IListHost) {
    const eventBus = host.eventBus;

    eventBus.on('updateUI', () => {
      if (
        host.settings.enableSpeech &&
        window.speechSynthesis &&
        host.currentStep > 0 &&
        host.history[host.currentStep - 1]
      ) {
        const node = host.history[host.currentStep - 1];
        if (node.move) {
          speak(node.move);
        }
      }
    });
  },
};

registerListModule('speech', SpeakerModule);
