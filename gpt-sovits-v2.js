import { getPreviewString, saveTtsProviderSettings } from './index.js';

export { GptSovitsV2Provider };

class GptSovitsV2Provider {
    //########//
    // Config //
    //########//

    settings;
    ready = false;
    voices = [];
    separator = '. ';
    audioElement = document.createElement('audio');

    /**
     * Perform any text processing before passing to TTS engine.
     * @param {string} text Input text
     * @returns {string} Processed text
     */
    processText(text) {
        text = text.replace('<br>', '\n'); // Replace <br> with newline
        return text;
    }

    audioFormats = ['wav', 'ogg', 'aac', 'raw'];

    languageLabels = {
        'zh': '中文',
        'en': '英文',
        'ja': '日文',
        'ko': '韩文',
    };

    defaultSettings = {
        provider_endpoint: 'http://localhost:9880',
        format: 'wav',
        lang: 'zh',
        prompt_lang: 'zh',
        streaming: false,
        text_split_method: 'cut5',
        batch_size: 1,
        batch_threshold: 0.75,
        speed_factor: 1.0,
        top_k: 5,
        top_p: 1.0,
        temperature: 1.0,
        repetition_penalty: 1.35
    };

    get settingsHtml() {
        let html = `
        <label for="tts_endpoint">Provider Endpoint:</label>
        <input id="tts_endpoint" type="text" class="text_pole" maxlength="250" height="300" value="${this.defaultSettings.provider_endpoint}"/>
        <span>Use <a target="_blank" href="https://github.com/ftsgyyds/SillyTavern-GPT_SovitsV2">GPT-SoVITS-V2</a>.</span><br/>

        <label for="lang">Text Language:</label>
        <select id="lang">`;

        for (let lang in this.languageLabels) {
            html += `<option value="${lang}" ${lang === this.defaultSettings.lang ? 'selected' : ''}>${this.languageLabels[lang]}</option>`;
        }

        html += `</select><br/>
        <label for="prompt_lang">Prompt Language:</label>
        <select id="prompt_lang">`;

        for (let lang in this.languageLabels) {
            html += `<option value="${lang}" ${lang === this.defaultSettings.prompt_lang ? 'selected' : ''}>${this.languageLabels[lang]}</option>`;
        }

        html += `</select><br/>
        <label for="format">Audio Format:</label>
        <select id="format">`;

        for (let format of this.audioFormats) {
            html += `<option value="${format}" ${format === this.defaultSettings.format ? 'selected' : ''}>${format}</option>`;
        }

        html += `</select><br/>
        <label for="streaming" class="checkbox_label">
            <input id="streaming" type="checkbox" ${this.defaultSettings.streaming ? 'checked' : ''}/>
            <span>Streaming</span>
        </label><br/>
        
        <label for="text_split_method">切分:</label>
        <select id="text_split_method">`;
        // You might want to fetch available methods from the API dynamically
        // For now, assume these are the options
        const textSplitMethods = ['cut0', 'cut1', 'cut2', 'cut3', 'cut4', 'cut5'];
        const textSplitMethodLabels = {
            'cut0': '不切',
            'cut1': '凑四句一切',
            'cut2': '凑50字一切',
            'cut3': '按中文句号。切',
            'cut4': '按英文句号.切',
            'cut5': '按标点符号切'
        };
        for (let method of textSplitMethods) {
            html += `<option value="${method}" ${method === this.defaultSettings.text_split_method ? 'selected' : ''}>${textSplitMethodLabels[method]}</option>`;
        }
        html += `</select><br/>
        
        <label for="batch_size">并行 数量: <span id="batch_size_output">${this.defaultSettings.batch_size}</span></label>
        <input id="batch_size" type="range" value="${this.defaultSettings.batch_size}" min="1" max="50" step="1" /><br/>

        <label for="batch_threshold">Batch Threshold: <span id="batch_threshold_output">${this.defaultSettings.batch_threshold}</span></label>
        <input id="batch_threshold" type="range" value="${this.defaultSettings.batch_threshold}" min="0.1" max="1.0" step="0.05" /><br/>

        <label for="speed_factor">语速: <span id="speed_factor_output">${this.defaultSettings.speed_factor}</span></label>
        <input id="speed_factor" type="range" value="${this.defaultSettings.speed_factor}" min="0.5" max="2.0" step="0.05" /><br/>

        <label for="top_k">Top K: <span id="top_k_output">${this.defaultSettings.top_k}</span></label>
        <input id="top_k" type="range" value="${this.defaultSettings.top_k}" min="0" max="100" step="1" /><br/>

        <label for="top_p">Top P: <span id="top_p_output">${this.defaultSettings.top_p}</span></label>
        <input id="top_p" type="range" value="${this.defaultSettings.top_p}" min="0.0" max="1.0" step="0.01" /><br/>

        <label for="temperature">Temperature: <span id="temperature_output">${this.defaultSettings.temperature}</span></label>
        <input id="temperature" type="range" value="${this.defaultSettings.temperature}" min="0.01" max="2.0" step="0.01" /><br/>

        <label for="repetition_penalty">重复惩罚: <span id="repetition_penalty_output">${this.defaultSettings.repetition_penalty}</span></label>
        <input id="repetition_penalty" type="range" value="${this.defaultSettings.repetition_penalty}" min="1.0" max="2.0" step="0.01" /><br/>

        <label for="gpt_weights">GPT Weights (v1):</label>
        <select id="gpt_weights"></select><br/>

        <label for="sovits_weights">SoVITS Weights (v1):</label>
        <select id="sovits_weights"></select><br/>

        <button id="change_model_button" style="
          background: linear-gradient(to right, #f2994a, #f2c94c, #6fcf97, #9b51e0, #3b82f6);
          background-size: 500% auto;
          color: white;
          border: none;
          padding: 10px 20px;
          text-align: center;
          text-decoration: none;
          display: inline-block;
          font-size: 16px;
          border-radius: 5px;
          animation: gradient 5s ease infinite;
        ">Change Model</button>
        `;

        return html;
    }

    onSettingsChange() {
        this.settings.provider_endpoint = $('#tts_endpoint').val();
        this.settings.lang = $('#lang').val();
        this.settings.prompt_lang = $('#prompt_lang').val();
        this.settings.format = $('#format').val();
        this.settings.streaming = $('#streaming').is(':checked');
        this.settings.text_split_method = $('#text_split_method').val();
        this.settings.batch_size = parseInt($('#batch_size').val(), 10);
        this.settings.batch_threshold = parseFloat($('#batch_threshold').val());
        this.settings.speed_factor = parseFloat($('#speed_factor').val());
        this.settings.top_k = parseInt($('#top_k').val(), 10);
        this.settings.top_p = parseFloat($('#top_p').val());
        this.settings.temperature = parseFloat($('#temperature').val());
        this.settings.repetition_penalty = parseFloat($('#repetition_penalty').val());

        // Update UI to reflect changes
        $('#batch_size_output').text(this.settings.batch_size);
        $('#batch_threshold_output').text(this.settings.batch_threshold);
        $('#speed_factor_output').text(this.settings.speed_factor);
        $('#top_k_output').text(this.settings.top_k);
        $('#top_p_output').text(this.settings.top_p);
        $('#temperature_output').text(this.settings.temperature);
        $('#repetition_penalty_output').text(this.settings.repetition_penalty);

        saveTtsProviderSettings();
        this.changeTTSSettings();
    }

    async loadSettings(settings) {
        if (Object.keys(settings).length === 0) {
            console.info('Using default TTS Provider settings');
        }

        this.settings = { ...this.defaultSettings, ...settings };

        // Set initial values from the settings
        $('#tts_endpoint').val(this.settings.provider_endpoint);
        $('#lang').val(this.settings.lang);
        $('#prompt_lang').val(this.settings.prompt_lang);
        $('#format').val(this.settings.format);
        $('#streaming').prop('checked', this.settings.streaming);
        $('#text_split_method').val(this.settings.text_split_method);
        $('#batch_size').val(this.settings.batch_size);
        $('#batch_threshold').val(this.settings.batch_threshold);
        $('#speed_factor').val(this.settings.speed_factor);
        $('#top_k').val(this.settings.top_k);
        $('#top_p').val(this.settings.top_p);
        $('#temperature').val(this.settings.temperature);
        $('#repetition_penalty').val(this.settings.repetition_penalty);

        // Update UI to reflect initial settings 
        $('#batch_size_output').text(this.settings.batch_size);
        $('#batch_threshold_output').text(this.settings.batch_threshold);
        $('#speed_factor_output').text(this.settings.speed_factor);
        $('#top_k_output').text(this.settings.top_k);
        $('#top_p_output').text(this.settings.top_p);
        $('#temperature_output').text(this.settings.temperature);
        $('#repetition_penalty_output').text(this.settings.repetition_penalty);

        // Register event listeners
        $('#tts_endpoint, #lang, #prompt_lang, #format, #streaming, #text_split_method, #batch_size, #batch_threshold, #speed_factor, #top_k, #top_p, #temperature, #repetition_penalty, #change_model_button').on('input change click', () => {
            if (event.target.id === 'change_model_button') {
                this.changeModel(); // Call changeModel function for button click
            } else {
                this.onSettingsChange();
            }
        });


        await this.checkReady();
        await this.fetchAvailableModels(); // Fetch available models on load
        console.info('GPT-SoVITS-V2: Settings loaded');
    }

    async checkReady() {
        await Promise.allSettled([this.fetchTtsVoiceObjects(), this.changeTTSSettings()]);
    }

    async onRefreshClick() {
        return;
    }

    //#################//
    //  TTS Interfaces //
    //#################//

    async getVoice(voiceName) {
        if (this.voices.length === 0) {
            this.voices = await this.fetchTtsVoiceObjects();
        }

        const match = this.voices.filter(v => v.name === voiceName)[0];

        if (!match) {
            throw `TTS Voice name ${voiceName} not found`;
        }
        return match;
    }

    async generateTts(text, voiceId) {
        const response = await this.fetchTtsGeneration(text, voiceId);
        return response;
    }

    //###########//
    // API CALLS //
    //###########//
    async fetchTtsVoiceObjects() {
        const response = await fetch(`${this.settings.provider_endpoint}/speakers`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.json()}`);
        }
        const responseJson = await response.json();
        this.voices = responseJson;
        return responseJson;
    }

    async changeTTSSettings() {
        // No specific settings to change in GPT-SoVITS-V2 based on these UI settings
        // You might want to add logic here if your API supports dynamic settings changes
    }

    async fetchTtsGeneration(inputText, voiceId) {
        console.info(`Generating new TTS for voice_id ${voiceId}`);

        const params = {
            text: inputText,
            ref_audio_path: `./参考音频/${voiceId}.wav`, // Assuming this path structure
            text_lang: this.settings.lang,
            prompt_lang: this.settings.prompt_lang,
            text_split_method: this.settings.text_split_method,
            batch_size: this.settings.batch_size,
            batch_threshold: this.settings.batch_threshold,
            speed_factor: this.settings.speed_factor,
            top_k: this.settings.top_k,
            top_p: this.settings.top_p,
            temperature: this.settings.temperature,
            media_type: this.settings.format,
            streaming_mode: this.settings.streaming.toString(),
            repetition_penalty: this.settings.repetition_penalty,
        };

        const url = `${this.settings.provider_endpoint}/`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(params),
        });

        if (!response.ok) {
            toastr.error(response.statusText, 'TTS Generation Failed');
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
        return response;
    }

    async fetchTtsFromHistory(history_item_id) {
        return Promise.resolve(history_item_id);
    }

    async fetchAvailableModels() {
        const response = await fetch(`${this.settings.provider_endpoint}/available_models`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
        const models = await response.json();
        this.populateModelDropdowns(models);
    }

    populateModelDropdowns(models) {
        const gptSelect = $('#gpt_weights');
        const sovitsSelect = $('#sovits_weights');
        const gptV2Select = $('#gpt_weights_v2');
        const sovitsV2Select = $('#sovits_weights_v2');

        gptSelect.empty();
        sovitsSelect.empty();
        gptV2Select.empty();
        sovitsV2Select.empty();

        models.gpt_weights.forEach(model => {
            gptSelect.append(`<option value="${model}">${model}</option>`);
        });
        models.sovits_weights.forEach(model => {
            sovitsSelect.append(`<option value="${model}">${model}</option>`);
        });
        models.gpt_weights_v2.forEach(model => {
            gptV2Select.append(`<option value="${model}">${model}</option>`);
        });
        models.sovits_weights_v2.forEach(model => {
            sovitsV2Select.append(`<option value="${model}">${model}</option>`);
        });
    }

    async changeModel() {
        const gptWeights = $('#gpt_weights').val();
        const sovitsWeights = $('#sovits_weights').val();
        const gptWeightsV2 = $('#gpt_weights_v2').val();
        const sovitsWeightsV2 = $('#sovits_weights_v2').val();

        const url = new URL(`${this.settings.provider_endpoint}/set_model`);
        if (gptWeights && sovitsWeights) {
            url.searchParams.append('gpt_weights', gptWeights);
            url.searchParams.append('sovits_weights', sovitsWeights);
        } else if (gptWeightsV2 && sovitsWeightsV2) {
            url.searchParams.append('gpt_weights_v2', gptWeightsV2);
            url.searchParams.append('sovits_weights_v2', sovitsWeightsV2);
        }

        const response = await fetch(url.toString());
        if (!response.ok) {
            toastr.error(response.statusText, 'Failed to Change Model');
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
        toastr.success('Model Changed Successfully');
    }
}