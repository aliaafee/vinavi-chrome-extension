var selectedListElem = null;

document.addEventListener("DOMContentLoaded", function () {
    onPopupLoaded();
});

async function getActiveTab() {
    let queryOptions = { active: true, currentWindow: true };
    let [tab] = await chrome.tabs.query(queryOptions);
    return tab;
}

async function getCases(page) {
    const activeTab = await getActiveTab();

    return await chrome.tabs.sendMessage(
        activeTab.id,
        {
            "action": "getCases",
            "page": page
        }
    );
}

// async function getEpisodes(caseId) {
//     const activeTab = await getActiveTab();

//     return await chrome.tabs.sendMessage(
//         activeTab.id,
//         {
//             "action": "getEpisodes",
//             "caseId": caseId
//         }
//     );
// }

async function getEpisodeDetail(episodeId) {
    const activeTab = await getActiveTab();

    return await chrome.tabs.sendMessage(
        activeTab.id,
        {
            "action": "getEpisodeDetail",
            "episodeId": episodeId
        }
    );
}

async function onPopupLoaded() {
    const listElement = document.getElementById("list");
    listElement.innerHTML = `<div id="loading">Loading...</div>`;

    const cases = await getCases(1);

    console.log(cases);

    if (cases === null) {
        listElement.innerHTML = `<div id="error">Not found</div>`;
        return
    }

    const casesElement = await createCasesElement(cases);

    listElement.innerHTML = "";
    listElement.appendChild(casesElement);
}

async function createCaseItems(cases, addMoreListElements) {
    const includedMap = createIncludedMap(cases);

    const caseElements = cases.data.map((patientCase) => {
        const doctor = includedMap.professionals[patientCase.relationships.doctor.data.id]['attributes'];

        const caseElement = document.createElement("li");

        const headerElement = document.createElement("div");
        headerElement.innerHTML = `<span>case</span><span>${patientCase.attributes.created_at}</span><span>${doctor.fullname}</span>`;
        caseElement.append(headerElement);

        const detailsElement = document.createElement("div");
        caseElement.appendChild(detailsElement);

        const episodesElement = document.createElement("ul");
        detailsElement.append(episodesElement)

        episodesElement.append(...patientCase.relationships.episodes.data.map((episodeData) => {
            const episode = includedMap.episodes[episodeData.id];
            const doctor = includedMap.professionals[episode.relationships.doctor.data.id]['attributes'];

            const el = document.createElement("li");
            el.innerHTML = `<span>episode</span><span>${episode.attributes.created_at}</span><span>${doctor.fullname}</span>`;

            el.onclick = async () => {
                if (selectedListElem !== null) {
                    selectedListElem.classList.remove("selected");
                }
                selectedListElem = el;
                selectedListElem.classList.add("selected");

                const detailElement = document.getElementById("detail");
    
                detailElement.innerHTML = "Loading..."
    
                const episodeDetail = await getEpisodeDetail(episode.id);
                const episodeDetailElement = await createEpisodeDetailElement(episodeDetail);
    
                detailElement.innerHTML = "";
                detailElement.appendChild(episodeDetailElement);
            }

            return el;
        }))
        return caseElement;
    })

    if (cases.meta.last_page > cases.meta.current_page) {
        const moreButton = document.createElement("li");
        moreButton.className = "load-more"
        moreButton.innerHTML = "Load more";
        moreButton.onclick = async () => {
            moreButton.innerHTML = "Loading...";
            moreButton.onclick = () => {};
            const moreCases = await getCases(cases.meta.current_page + 1);
            moreButton.remove();
            if (moreCases === null) {
                const failedEl = document.createElement('li');
                failedEl.className = "failed-load";
                failedEl.innerHTML = "Failed to load more";
                addMoreListElements([failedEl]);
                return
            }
            addMoreListElements((await createCaseItems(moreCases, addMoreListElements)))
        }

        return caseElements.concat([moreButton])
    }

    return caseElements
}

async function createCasesElement(cases) {
    const casesElement = document.createElement("ul");
    casesElement.append(...(await createCaseItems(cases, (moreListElements) => {
        casesElement.append(...moreListElements);
    })));

    return casesElement
}

// async function createEpisodesElement(episodes) {
//     const includedMap = createIncludedMap(episodes);

//     const episodesElement = document.createElement("ul");

//     episodesElement.appendChild(...episodes.data.map((episode) => {
//         const doctor = includedMap.professionals[episode.relationships.doctor.data.id]['attributes'];

//         const episodeElement = document.createElement("li");
//         episodeElement.innerHTML = `<span>episode</span><span>${episode.attributes.created_at}</span><span>${doctor.fullname}</span>`

//         episodeElement.onclick = async () => {
//             const detailElement = document.getElementById("detail");

//             detailElement.innerHTML = "Loading..."

//             const episodeDetail = await getEpisodeDetail(episode.id);
//             const episodeDetailElement = await createEpisodeDetailElement(episodeDetail);

//             detailElement.innerHTML = "";
//             detailElement.appendChild(episodeDetailElement);
//         }

//         return episodeElement;
//     }));

//     return episodesElement;
// }


async function createEpisodeDetailElement(episodeDetail) {
    const includedMap = createIncludedMap(episodeDetail);

    const doctor = includedMap.professionals[episodeDetail.data.relationships.doctor.data.id]['attributes'];

    const detailElement = document.createElement("div");

    const episodeId = episodeDetail.data.id;
    const patientId = episodeDetail.data.relationships.patient.data.id;

    const episodeHeading = document.createElement("h2");
    episodeHeading.innerHTML = `Episode ` +
        `<a target="_blank" href="https://vinavi.aasandha.mv/#/patients/${patientId}/episodes/${episodeId}">open &#11194;</a>`;

    const episodeInfo = document.createElement("ul");
    episodeInfo.className = 'episode-info';
    episodeInfo.innerHTML = `<li><span>created at</span><span>${episodeDetail.data.attributes.created_at}</span></li>` +
        `<li><span>visited on</span><span>${episodeDetail.data.attributes.visited_on}</span></li>` +
        `<li><span>doctor</span><span>${doctor.fullname}</span></li>`

    const noteHeading = document.createElement("h2");
    noteHeading.innerHTML = "Notes";

    const noteList = document.createElement("ul");
    noteList.className = "notes-list";
    noteList.append(...episodeDetail.data.relationships.notes.data.map((noteData) => {
        note = includedMap[noteData.type][noteData.id]['attributes'];

        const el = document.createElement("li");
        el.classList = ['note', note.note_type]
        el.innerHTML = `<span>${note.note_type}</span><span>${note.notes}</span>`
        return el
    }))

    const diagnosisHeading = document.createElement("h2");
    diagnosisHeading.innerHTML = "Diagnosis";

    const diagnosisList = document.createElement("ul");
    diagnosisList.className = 'diagnosis-list';
    diagnosisList.append(...episodeDetail.data.relationships.diagnoses.data.map((diagData) => {
        const diagnosis = includedMap['diagnoses'][diagData.id]['attributes'];

        const el = document.createElement("li");
        el.innerHTML = `<span>${diagnosis['icd-code']['code']}</span>` +
            `<span>${diagnosis['icd-code']['title']}</span>` +
            `<span>${(diagnosis['remarks'] === null) ? "" : diagnosis['remarks']}</span>`;

        return el;
    }));

    const presciptionHeading = document.createElement("h2");
    presciptionHeading.innerHTML = "Prescription";

    const prescriotionList = document.createElement("ul");
    prescriotionList.className = "prescription-list";
    prescriotionList.append(...episodeDetail.data.relationships.prescriptions.data.map((prescriptionData) => {
        const prescriptionItem = includedMap['prescriptions'][prescriptionData.id];

        const prescElement = document.createElement("li");
        prescElement.innerHTML = `<div><span>created at</span> <span>${prescriptionItem.attributes.created_at}</span></div>`;

        console.log(prescriptionItem);
        console.log(includedMap);
        const medicineList = document.createElement("ol");
        medicineList.append(...prescriptionItem.relationships.medicines.data.map((medicineData) => {
            const prescription_medicine = includedMap['prescription-medicines'][medicineData.id];

            const el = document.createElement("li");

            if (prescription_medicine.relationships['preferred-medicine'].data !== null) {
                const preferred_medicine = includedMap['medicines'][prescription_medicine.relationships['preferred-medicine'].data.id];
                el.innerHTML = `<span>${preferred_medicine.attributes.preparation}</span> ` +
                    `<span class="medicine-name">${preferred_medicine.attributes.name}</span> ` +
                    `<span>${preferred_medicine.attributes.strength}</span> ` +
                    `<span>${prescription_medicine.attributes.instructions}</span>`;
            } else {
                el.innerHTML = `<span class="medicine-name">${prescription_medicine.attributes.name}</span> ` +
                    `<span>${prescription_medicine.attributes.instructions}</span>`;
            }

            return el;
        }))
        medicineList.append(...prescriptionItem.relationships.consumables.data.map((medicineData) => {
            const el = document.createElement("li");
            el.innerHTML = "? consumable"
            return el;
        }))


        prescElement.append(medicineList);
        return prescElement;
    }));

    detailElement.append(
        episodeHeading,
        episodeInfo,
        diagnosisHeading,
        diagnosisList,
        noteHeading,
        noteList,
        presciptionHeading,
        prescriotionList
    )

    return detailElement;
}


function createIncludedMap(item) {
    var map = {};

    item.included.forEach((itemIncluded) => {
        if (!(itemIncluded.type in map)) {
            map[itemIncluded.type] = {}
        }
        map[itemIncluded.type][itemIncluded.id] = itemIncluded;
    })

    return map;
}