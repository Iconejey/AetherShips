class UtilitySliders extends HTMLElement {
	connectedCallback() {
		this.innerHTML = html`
			<div class="slider-container">
				<div class="slider-header main-header" id="main-header">
					<span class="icon-label">
						<span class="icon">bolt</span>
						<span>Capacitors</span>
					</span>
					<span id="main-value" class="value">0%</span>
				</div>
				<div class="slider-bar main-bar">
					<div class="slider-fill" id="main-fill"></div>
				</div>
				<div class="sub-sliders" id="sub-sliders"></div>
			</div>
		`;

		this.$('#main-header').addEventListener('click', () => {
			this.$('#sub-sliders').classList.toggle('open');
		});

		this.updateLoop = requestAnimationFrame(() => this.tick());
	}

	disconnectedCallback() {
		if (this.updateLoop) cancelAnimationFrame(this.updateLoop);
	}

	tick() {
		this.updateLoop = requestAnimationFrame(() => this.tick());
		const entity = window.game?.player?.driven_entity;

		if (!entity || !entity.utility_rect_groups) {
			this.style.display = 'none';
			return;
		}

		let total_charge = 0;
		let total_max = 0;
		const sub_data = [];

		for (const group of entity.utility_rect_groups) {
			const block_def = typeof blocks_by_type !== 'undefined' ? blocks_by_type[group.type] : null;
			if (block_def && (block_def.name === 'basic_capacitor' || block_def.name === 'high_density_capacitor')) {
				const info = entity.getGroupInfo(group);
				const capacity = info?.capacity || 0;
				const charge = group.data?.charge || 0;

				total_charge += charge;
				total_max += capacity;

				sub_data.push({ charge, capacity, name: block_def.name });
			}
		}

		if (total_max === 0) {
			this.style.display = 'none';
			return;
		}

		this.style.display = 'flex';

		const main_pct = Math.max(0, Math.min(100, (total_charge / total_max) * 100));
		const main_value_el = this.$('#main-value');
		const main_fill_el = this.$('#main-fill');
		if (main_value_el) main_value_el.innerText = `${Math.round(main_pct)}%`;
		if (main_fill_el) main_fill_el.style.width = `${main_pct}%`;

		const sub_container = this.$('#sub-sliders');
		if (sub_container && sub_container.children.length !== sub_data.length) {
			sub_container.innerHTML = sub_data
				.map(
					(data, i) => html`
						<div class="slider-container">
							<div class="slider-header sub-header">
								<span class="icon-label">
									<span class="icon">bolt</span>
									${i + 1}
								</span>
								<span id="sub-value-${i}" class="value">0%</span>
							</div>
							<div class="slider-bar sub-bar">
								<div class="slider-fill" id="sub-fill-${i}"></div>
							</div>
						</div>
					`
				)
				.join('');
		}

		sub_data.forEach((data, i) => {
			const pct = data.capacity > 0 ? Math.max(0, Math.min(100, (data.charge / data.capacity) * 100)) : 0;
			const el_val = this.$(`#sub-value-${i}`);
			const el_fill = this.$(`#sub-fill-${i}`);
			if (el_val) el_val.innerText = `${Math.round(pct)}%`;
			if (el_fill) el_fill.style.width = `${pct}%`;
		});
	}
}

customElements.define('utility-sliders', UtilitySliders);
