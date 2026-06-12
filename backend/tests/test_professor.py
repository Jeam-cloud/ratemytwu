def test_search_professor_empty_list(client):
    response = client.get("/professor/?search_professor=im not a professor")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_get_professor_does_not_exist(client):
    response = client.get("/professor/6969/everything")
    assert response.status_code == 404

def test_get_professor_and_courses_if_exists(client):
    response = client.get("/professor/9999/courses")
    assert response.status_code == 404
