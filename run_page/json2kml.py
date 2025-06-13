import json
from datetime import datetime

def convert_json_file_to_kml(input_filename, output_filename="output.kml"):
    """
    Reads location data from a JSON file and converts it to a KML file.

    Args:
        input_filename (str): The path to the input JSON file.
        output_filename (str): The name of the KML file to be created.
    """
    try:
        with open(input_filename, 'r', encoding='utf-8') as f:
            json_data = json.load(f)
    except FileNotFoundError:
        print(f"错误: 找不到文件 '{input_filename}'。请检查文件路径和名称。")
        return
    except json.JSONDecodeError:
        print(f"错误: 无法解析文件 '{input_filename}'。请确保它是有效的JSON格式。")
        return
    except Exception as e:
        print(f"读取文件时发生未知错误: {e}")
        return

    kml_header = """<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>轨迹数据</name>
    <description>从JSON转换的地理轨迹</description>
    <Style id="pathStyle">
      <LineStyle>
        <color>ff0000ff</color>
        <width>3</width>
      </LineStyle>
    </Style>
    <Placemark>
      <name>轨迹</name>
      <description>记录的路线</description>
      <styleUrl>#pathStyle</styleUrl>
      <LineString>
        <extrude>true</extrude>
        <tessellate>true</tessellate>
        <altitudeMode>relativeToGround</altitudeMode>
        <coordinates>
"""

    kml_footer = """
        </coordinates>
      </LineString>
    </Placemark>
"""

    placemarks_header = """
    <Folder>
      <name>地点标记</name>
"""

    placemarks_footer = """
    </Folder>
"""

    kml_end = """
  </Document>
</kml>
"""

    coordinates = []
    placemarks = []

    for point in json_data:
        try:
            lon = point.get("lon")
            lat = point.get("lat")
            # Use elevation if available, otherwise default to "0.0" or omit
            elevation = point.get("elevation", "0.0")
            if elevation == "": # Handle empty string for elevation
                elevation = "0.0"

            # Format coordinates as "longitude,latitude,altitude"
            coordinates.append(f"{lon},{lat},{elevation}")

            # Create Placemark for each point (optional, but good for detailed view)
            time_str = point.get("time", "")
            # Convert ISO 8601 time to a more readable format for KML description
            if time_str:
                try:
                    dt_object = datetime.fromisoformat(time_str.replace('Z', '+00:00'))
                    formatted_time = dt_object.strftime("%Y-%m-%d %H:%M:%S UTC")
                except ValueError:
                    formatted_time = time_str # Fallback if parsing fails
            else:
                formatted_time = "N/A"

            annotation = point.get("annotation", "无备注")
            speed = point.get("speed", "N/A")
            battery = point.get("battery", "N/A")
            accuracy = point.get("accuracy", "N/A")
            satellites = point.get("satellites", "N/A")
            provider = point.get("provider", "N/A")

            placemark = f"""
      <Placemark>
        <name>时间: {formatted_time}</name>
        <description><![CDATA[
          <b>经度:</b> {lon}<br/>
          <b>纬度:</b> {lat}<br/>
          <b>海拔:</b> {elevation} 米<br/>
          <b>速度:</b> {speed} 米/秒<br/>
          <b>精度:</b> {accuracy} 米<br/>
          <b>卫星数量:</b> {satellites}<br/>
          <b>提供者:</b> {provider}<br/>
          <b>电量:</b> {battery}%<br/>
          <b>备注:</b> {annotation}
        ]]></description>
        <Point>
          <coordinates>{lon},{lat},{elevation}</coordinates>
        </Point>
      </Placemark>
"""
            placemarks.append(placemark)

        except KeyError as e:
            print(f"警告: 跳过一个点，因为缺少键 '{e}'。数据: {point}")
        except Exception as e:
            print(f"处理一个点时发生错误: {e}。数据: {point}")

    # Join coordinates for the LineString
    coordinates_str = "\n".join(coordinates)

    # Join all placemarks
    placemarks_str = "".join(placemarks)

    # Assemble the full KML content
    kml_content = (
        kml_header +
        coordinates_str +
        kml_footer +
        placemarks_header +
        placemarks_str +
        placemarks_footer +
        kml_end
    )

    # Write the KML content to a file
    try:
        with open(output_filename, "w", encoding="utf-8") as f:
            f.write(kml_content)
        print(f"KML文件已成功创建: {output_filename}")
    except Exception as e:
        print(f"写入KML文件时发生错误: {e}")



# 然后在脚本中运行：
convert_json_file_to_kml("test.json", "my_track_from_file.kml")